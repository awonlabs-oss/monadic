"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { ALL_STATUSES, type Status } from "@/lib/applications/pipeline";

/**
 * Every write the UI performs.
 *
 * All of them go through the SQL functions rather than writing tables directly,
 * because each one has to move two tables at once and the function is what makes
 * that atomic: save_job writes the interaction and its signal, create_application
 * writes the application and its first timeline event, set_application_status
 * writes the status and the event recording the change. Doing any of it from
 * here in two calls would eventually leave a status with no event behind it, and
 * the timeline is meant to be the source of truth.
 *
 * They run as the signed-in user through getServerClient, so RLS applies to
 * these writes exactly as it does to reads.
 */

export async function saveJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const db = await getServerClient();
  const { error } = await db.rpc("save_job", { p_job_id: jobId });
  if (error) throw new Error(`Could not save job: ${error.message}`);

  revalidatePath("/jobs");
}

export async function trackJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  const db = await getServerClient();
  const { error } = await db.rpc("create_application", {
    p_job_id: jobId,
    p_source: "job_feed",
  });

  // A second Track on the same job hits the unique (user_id, job_id) index.
  // That is the constraint doing its job, not a failure worth showing.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw new Error(`Could not track job: ${error.message}`);
  }

  revalidatePath("/jobs");
  revalidatePath("/applications");
}

export async function setStatusAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const status = String(formData.get("status") ?? "") as Status;
  if (!applicationId || !ALL_STATUSES.includes(status)) return;

  const db = await getServerClient();
  const { error } = await db.rpc("set_application_status", {
    p_application_id: applicationId,
    p_status: status,
  });
  if (error) throw new Error(`Could not change status: ${error.message}`);

  revalidatePath("/applications");
}

export async function setNextActionAction(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) return;

  const action = String(formData.get("nextAction") ?? "").trim();
  const date = String(formData.get("nextActionAt") ?? "").trim();

  const db = await getServerClient();

  // Clearing is a real intent, not an empty form, so blanks write null rather
  // than being ignored.
  const { error } = await db
    .from("applications")
    .update({
      next_action: action || null,
      next_action_at: date || null,
    })
    .eq("id", applicationId);

  if (error) throw new Error(`Could not set next action: ${error.message}`);

  // The note goes on the timeline as its own event. next_action is a mutable
  // field on the application; the timeline is what remembers that you decided
  // it, and when.
  if (action) {
    const { error: eventError } = await db.from("application_events").insert({
      user_id: (await db.auth.getUser()).data.user?.id as string,
      application_id: applicationId,
      event_type: "task",
      title: action,
      body: date ? `Due ${date}` : null,
    });
    if (eventError) throw new Error(`Could not log next action: ${eventError.message}`);
  }

  revalidatePath("/applications");
}
