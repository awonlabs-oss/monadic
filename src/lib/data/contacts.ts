import { getServerClient } from "@/lib/supabase/server";
import type { ContactRole } from "@/lib/contacts/roles";

/**
 * People, and the applications they sit beside.
 *
 * The schema for this has existed since the first migration and had no code
 * against it. Two shapes in it are worth reading before adding to this file,
 * because they are decisions rather than defaults:
 *
 * A contact hangs off a *company*, not an application. The same recruiter
 * appears again on the next role at the same company, and duplicating them per
 * application would mean the second copy has none of the history of the first.
 * `application_contacts` is the join, and it carries its own
 * `role_in_process` — someone can be a referral on one application and an
 * interviewer on the next.
 *
 * `provider` defaults to 'manual' and sits beside `provider_record_id`,
 * `provider_confidence` and `raw`. Nothing imports contacts yet, but the
 * columns are there so that when something does, a machine-sourced contact is
 * distinguishable from one you typed and a confidence score has somewhere to
 * live rather than being bolted on later.
 */

export { CONTACT_ROLES, ROLE_LABELS, type ContactRole } from "@/lib/contacts/roles";

export interface ContactRow {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  role: string | null;
  notes: string | null;
  provider: string;
  company_id: string | null;
  created_at: string;
  company: { id: string; name: string; slug: string; logo_url: string | null } | null;
  /** How many applications this contact is attached to. */
  application_count: number;
  /** How many outreach messages have been written to them. */
  message_count: number;
}

const COLUMNS =
  "id, full_name, title, email, phone, linkedin_url, role, notes, provider, company_id, created_at, companies(id, name, slug, logo_url)";

export async function listContacts(): Promise<ContactRow[]> {
  const db = await getServerClient();

  const [contacts, links, messages] = await Promise.all([
    db.from("contacts").select(COLUMNS).order("created_at", { ascending: false }),
    db.from("application_contacts").select("contact_id"),
    db.from("outreach_messages").select("contact_id"),
  ]);
  if (contacts.error) throw new Error(`listContacts: ${contacts.error.message}`);

  // Counted in memory rather than with a grouped view. Both tables are small
  // and per-user, and a view would be a migration for two numbers.
  const applications = new Map<string, number>();
  for (const row of links.data ?? []) {
    applications.set(row.contact_id, (applications.get(row.contact_id) ?? 0) + 1);
  }
  const written = new Map<string, number>();
  for (const row of messages.data ?? []) {
    written.set(row.contact_id, (written.get(row.contact_id) ?? 0) + 1);
  }

  return (contacts.data ?? []).map((row) => {
    const r = row as unknown as Omit<ContactRow, "company" | "application_count" | "message_count"> & {
      companies: ContactRow["company"];
    };
    return {
      ...r,
      company: r.companies ?? null,
      application_count: applications.get(r.id) ?? 0,
      message_count: written.get(r.id) ?? 0,
    };
  });
}

export async function getContact(id: string): Promise<ContactRow | null> {
  const db = await getServerClient();
  const { data, error } = await db.from("contacts").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    // A malformed uuid from a hand-edited URL is "no such contact", not a 500.
    if (error.code === "22P02") return null;
    throw new Error(`getContact: ${error.message}`);
  }
  if (!data) return null;
  const r = data as unknown as Omit<ContactRow, "company" | "application_count" | "message_count"> & {
    companies: ContactRow["company"];
  };
  return { ...r, company: r.companies ?? null, application_count: 0, message_count: 0 };
}

/** A contact as the outreach hub sees them: plus whether they are attached here. */
export interface ApplicationContact extends ContactRow {
  /** True when application_contacts joins them to this application. */
  linked: boolean;
  /** The role they play in *this* process, which can differ from their usual one. */
  role_in_process: string | null;
  /** Messages written to them about this application specifically. */
  messages_here: number;
}

/**
 * Who you could talk to about one application.
 *
 * Two groups, deliberately merged rather than kept apart: the people already
 * attached to this application, and everyone else at the same company. The
 * second group is the point — a contact hangs off a company, so the recruiter
 * you met on a previous role at this company is already in the database and
 * nothing would ever surface them if this list only showed the join.
 *
 * Sorted attached-first, then by name. The ones you have already brought into
 * this process are the ones you are most likely to write to again.
 */
export async function contactsForApplication(
  applicationId: string,
  companyId: string | null,
): Promise<ApplicationContact[]> {
  const db = await getServerClient();

  const [company, links, messages] = await Promise.all([
    companyId
      ? db.from("contacts").select(COLUMNS).eq("company_id", companyId)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("application_contacts")
      .select("contact_id, role_in_process")
      .eq("application_id", applicationId),
    db.from("outreach_messages").select("contact_id").eq("application_id", applicationId),
  ]);
  if (company.error) throw new Error(`contactsForApplication: ${company.error.message}`);

  const linked = new Map<string, string | null>();
  for (const row of links.data ?? []) linked.set(row.contact_id, row.role_in_process);

  const written = new Map<string, number>();
  for (const row of messages.data ?? []) {
    written.set(row.contact_id, (written.get(row.contact_id) ?? 0) + 1);
  }

  // A contact linked to this application but sitting under a different company
  // — a referral from outside, say — would be missed by the company query, so
  // the join is read for its own rows too rather than only as a flag.
  const found = new Set((company.data ?? []).map((r) => (r as { id: string }).id));
  const strays = [...linked.keys()].filter((id) => !found.has(id));
  const extra = strays.length
    ? await db.from("contacts").select(COLUMNS).in("id", strays)
    : { data: [], error: null };
  if (extra.error) throw new Error(`contactsForApplication: ${extra.error.message}`);

  return [...(company.data ?? []), ...(extra.data ?? [])]
    .map((row) => {
      const r = row as unknown as Omit<
        ContactRow,
        "company" | "application_count" | "message_count"
      > & { companies: ContactRow["company"] };
      return {
        ...r,
        company: r.companies ?? null,
        application_count: 0,
        message_count: 0,
        linked: linked.has(r.id),
        role_in_process: linked.get(r.id) ?? null,
        messages_here: written.get(r.id) ?? 0,
      };
    })
    .sort((a, b) =>
      a.linked === b.linked
        ? a.full_name.localeCompare(b.full_name)
        : a.linked
          ? -1
          : 1,
    );
}

export interface ContactInput {
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  role: ContactRole | null;
  companyId: string | null;
  notes: string | null;
}

function toRow(input: ContactInput) {
  return {
    full_name: input.fullName.trim(),
    title: input.title?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    linkedin_url: input.linkedinUrl?.trim() || null,
    role: input.role,
    company_id: input.companyId,
    notes: input.notes?.trim() || null,
  };
}

export async function createContact(input: ContactInput): Promise<string> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");

  const { data, error } = await db
    .from("contacts")
    .insert({ ...toRow(input), user_id: user.user.id })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save the contact: ${error.message}`);
  return data.id;
}

export async function updateContact(id: string, input: ContactInput): Promise<void> {
  const db = await getServerClient();
  const { error } = await db
    .from("contacts")
    .update({ ...toRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not update the contact: ${error.message}`);
}

/**
 * Deleting a contact takes its outreach with it, by cascade.
 *
 * That is the schema's choice, not this function's: outreach_messages
 * references contacts on delete cascade. It is the right one — a message to
 * nobody is not a record of anything — but it means this is the one destructive
 * action here, and the UI confirms before calling it.
 */
export async function deleteContact(id: string): Promise<boolean> {
  const db = await getServerClient();
  const { data } = await db.from("contacts").select("id").eq("id", id).maybeSingle();
  if (!data) return false;
  const { error } = await db.from("contacts").delete().eq("id", id);
  if (error) throw new Error(`Could not delete: ${error.message}`);
  return true;
}

/** Attach a contact to an application. Idempotent — the join is unique. */
export async function linkContact(
  applicationId: string,
  contactId: string,
  roleInProcess: ContactRole | null,
): Promise<void> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");

  const { error } = await db.from("application_contacts").insert({
    user_id: user.user.id,
    application_id: applicationId,
    contact_id: contactId,
    role_in_process: roleInProcess,
  });
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw new Error(`Could not link the contact: ${error.message}`);
  }
}

export async function unlinkContact(applicationId: string, contactId: string): Promise<void> {
  const db = await getServerClient();
  const { error } = await db
    .from("application_contacts")
    .delete()
    .eq("application_id", applicationId)
    .eq("contact_id", contactId);
  if (error) throw new Error(`Could not unlink: ${error.message}`);
}
