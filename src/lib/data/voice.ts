import { getServerClient } from "@/lib/supabase/server";

/**
 * The sender's own writing, as the drafter receives it.
 *
 * Two kinds, and keeping them apart is the point. Guidelines are rules a person
 * can state; examples are emails they wrote. Examples carry the things nobody
 * can articulate about their own writing — sentence length, how they open, what
 * they leave out — which is most of what voice actually is.
 */

export interface VoiceExample {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  created_at: string;
}

export async function getGuidelines(): Promise<string> {
  const db = await getServerClient();
  const { data } = await db.from("outreach_voice").select("guidelines").maybeSingle();
  return data?.guidelines ?? "";
}

export async function saveGuidelines(guidelines: string): Promise<void> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");

  const { error } = await db.from("outreach_voice").upsert(
    { user_id: user.user.id, guidelines, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Could not save: ${error.message}`);
}

export async function listExamples(): Promise<VoiceExample[]> {
  const db = await getServerClient();
  const { data, error } = await db
    .from("outreach_templates")
    .select("id, name, subject, body, created_at")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listExamples: ${error.message}`);
  return (data ?? []) as VoiceExample[];
}

export async function addExample(input: {
  name: string;
  subject: string | null;
  body: string;
}): Promise<void> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");

  const { error } = await db.from("outreach_templates").insert({
    user_id: user.user.id,
    name: input.name,
    subject: input.subject,
    body: input.body,
    channel: "email",
  });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error(`You already have an example called "${input.name}".`);
    }
    throw new Error(`Could not save the example: ${error.message}`);
  }
}

export async function deleteExample(id: string): Promise<void> {
  const db = await getServerClient();
  const { error } = await db.from("outreach_templates").delete().eq("id", id);
  if (error) throw new Error(`Could not delete: ${error.message}`);
}
