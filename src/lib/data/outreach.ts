import { getServerClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data/profile";
import type { DraftContext } from "@/outreach/draft";

/**
 * Reading and writing outreach.
 *
 * A message is stored whether or not it was ever sent. That is the point of
 * keeping them: the second email to someone is easier to write when the first
 * one is in front of you, and a draft you abandoned is as useful for that as
 * one you sent. sent_at stays null until something actually leaves.
 */

export interface OutreachMessage {
  id: string;
  contact_id: string;
  application_id: string | null;
  subject: string | null;
  body: string;
  sent_at: string | null;
  created_at: string;
  variables_snapshot: unknown;
}

export async function listMessagesForContact(contactId: string): Promise<OutreachMessage[]> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("outreach_messages")
    .select("id, contact_id, application_id, subject, body, sent_at, created_at, variables_snapshot")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMessagesForContact: ${error.message}`);
  return (data ?? []) as unknown as OutreachMessage[];
}

/**
 * Everything written about one application, whoever it went to.
 *
 * The per-contact list answers "what have I said to this person"; this answers
 * "what has been said about this role", which is the question the hub exists
 * for — three emails to three people at the same company are one conversation
 * from where you are standing, and reading them one contact at a time is how
 * you repeat yourself.
 */
export async function listMessagesForApplication(
  applicationId: string,
): Promise<OutreachMessage[]> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("outreach_messages")
    .select("id, contact_id, application_id, subject, body, sent_at, created_at, variables_snapshot")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMessagesForApplication: ${error.message}`);
  return (data ?? []) as unknown as OutreachMessage[];
}

export async function saveMessage(input: {
  contactId: string;
  applicationId: string | null;
  subject: string;
  body: string;
  context: string;
}): Promise<string> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");

  const { data, error } = await db
    .from("outreach_messages")
    .insert({
      user_id: user.user.id,
      contact_id: input.contactId,
      application_id: input.applicationId,
      subject: input.subject,
      body: input.body,
      // What the model was actually given. The column exists for auditing a
      // draft that came out wrong, and without it "why did it say that" is
      // unanswerable a week later.
      variables_snapshot: { context: input.context } as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save the message: ${error.message}`);
  return data.id;
}

export async function markSent(messageId: string): Promise<void> {
  const db = await getServerClient();
  const { error } = await db
    .from("outreach_messages")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw new Error(`Could not mark as sent: ${error.message}`);
}

export async function deleteMessage(messageId: string): Promise<void> {
  const db = await getServerClient();
  const { error } = await db.from("outreach_messages").delete().eq("id", messageId);
  if (error) throw new Error(`Could not delete: ${error.message}`);
}

/**
 * Everything the drafter needs, gathered in one place.
 *
 * The job is optional and resolved from the application when one is given. A
 * contact with no application still gets a useful email — it is just about the
 * company rather than about a specific req.
 */
export async function buildDraftContext(args: {
  contactId: string;
  applicationId: string | null;
  previousMessageId: string | null;
  instructions: string;
}): Promise<DraftContext> {
  const db = await getServerClient();

  const [contactResult, profileResult] = await Promise.all([
    db
      .from("contacts")
      .select("full_name, title, role, companies(name)")
      .eq("id", args.contactId)
      .maybeSingle(),
    getProfile(),
  ]);
  if (!contactResult.data) throw new Error("That contact no longer exists.");
  const contact = contactResult.data as unknown as {
    full_name: string;
    title: string | null;
    role: string | null;
    companies: { name: string } | null;
  };

  let job: DraftContext["job"] = null;
  if (args.applicationId) {
    const { data } = await db
      .from("applications")
      .select("jobs(title, location_raw, description_text, companies(name))")
      .eq("id", args.applicationId)
      .maybeSingle();
    const row = (data as unknown as {
      jobs: {
        title: string;
        location_raw: string | null;
        description_text: string | null;
        companies: { name: string } | null;
      } | null;
    } | null)?.jobs;
    if (row) {
      job = {
        title: row.title,
        companyName: row.companies?.name ?? contact.companies?.name ?? "",
        locationRaw: row.location_raw,
        description: row.description_text,
      };
    }
  }

  let previous: DraftContext["previous"] = null;
  if (args.previousMessageId) {
    const { data } = await db
      .from("outreach_messages")
      .select("subject, body")
      .eq("id", args.previousMessageId)
      .maybeSingle();
    if (data) previous = { subject: data.subject, body: data.body };
  }

  // The sender's own voice: stated rules, and emails they actually wrote.
  // Fetched alongside everything else rather than lazily, because a draft
  // without them is a draft in nobody's voice and there is no cheaper moment
  // to decide that.
  const [voice, examples] = await Promise.all([
    db.from("outreach_voice").select("guidelines").maybeSingle(),
    db
      .from("outreach_templates")
      .select("name, subject, body")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const p = profileResult.profile;
  return {
    guidelines: voice.data?.guidelines ?? "",
    examples: (examples.data ?? []).map((e) => ({
      name: e.name,
      subject: e.subject,
      body: e.body,
    })),
    contact: { fullName: contact.full_name, title: contact.title, role: contact.role },
    company: contact.companies ? { name: contact.companies.name } : null,
    job,
    profile: p
      ? {
          fullName: p.full_name,
          headline: p.headline,
          summary: p.summary,
          yearsExperience: p.years_experience_total,
          experiences: profileResult.experiences.slice(0, 4).map((e) => ({
            title: e.title,
            company: e.company_name,
            description: e.description,
          })),
          skills: profileResult.skills.map((s) => s.name),
        }
      : null,
    previous,
    instructions: args.instructions,
  };
}
