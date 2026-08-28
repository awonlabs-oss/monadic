"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { ALL_STATUSES, type Status } from "@/lib/applications/pipeline";
import { saveCriteria } from "@/lib/data/criteria";
import { saveJob } from "@/lib/data/applications";

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

/**
 * Save: bookmark it and put it on the board, in one action.
 *
 * These used to be two buttons. Save wrote a bookmark and Track opened a
 * pipeline entry, and the split existed so that a browsing session of forty
 * saves could not flood the board. That is not how the feed is actually used —
 * saving a job *is* deciding to come back to it, which is what the board's
 * first column already means. Its label has read "Saved" since it was built.
 *
 * Both writes still happen. The interaction is what the feed reads to render
 * the button and what the sidebar's "Saved jobs" view filters on; the
 * application is the board row. Dropping either would break a surface that
 * currently works.
 *
 * Not atomic across the two, and it does not need to be: each RPC is atomic
 * with the row it owns, and the failure mode is a bookmark without a board
 * entry, which the next press repairs. A transaction spanning both would mean
 * a third SQL function whose only purpose is to call the other two.
 */
export async function saveJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;

  await saveJob(jobId);

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
  // The hub sets next actions too, and it is a dynamic child rather than a
  // segment of the list, so the list's path does not cover it.
  revalidatePath(`/applications/${applicationId}`);
}

/**
 * Saves the match criteria that drive /for-you.
 *
 * Roles arrive as one comma-separated field rather than a repeatable row, and
 * are split here. It is the shape of the thing being described — "forward
 * deployed engineer, solutions engineer" is how you would say it out loud — and
 * a chip editor with an add button is more machinery than three values need.
 *
 * Blank means unset, and unset means the criterion is not applied at all rather
 * than applied as zero. A pay floor of null is "I did not say"; a pay floor of 0
 * would be a criterion every job trivially meets and would inflate every score.
 */
export async function saveCriteriaAction(formData: FormData) {
  const list = (value: FormDataEntryValue | null) =>
    String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const number = (value: FormDataEntryValue | null) => {
    const raw = String(value ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const compFloor = number(formData.get("compFloor"));
  let yearsMin = number(formData.get("yearsMin"));
  let yearsMax = number(formData.get("yearsMax"));
  if (yearsMin !== null && yearsMax !== null && yearsMin > yearsMax) {
    [yearsMin, yearsMax] = [yearsMax, yearsMin];
  }

  await saveCriteria({
    targetRoleTypes: list(formData.get("roles")),
    locations: list(formData.get("locations")),
    remotePreference: String(formData.get("remote") ?? "") || null,
    yearsMin: yearsMin === null ? null : Math.max(0, Math.round(yearsMin)),
    // A band the wrong way round is a typo, not an intent. Swapping is kinder
    // than the check constraint rejecting the whole save.
    yearsMax: yearsMax === null ? null : Math.max(0, Math.round(yearsMax)),
    // Entered as thousands when it is obviously thousands: "130" means $130k,
    // and nobody is filtering for jobs paying at least one hundred and thirty
    // dollars a year.
    compFloor: compFloor === null ? null : compFloor < 1000 ? compFloor * 1000 : compFloor,
    recencyDays: Math.min(365, Math.max(1, number(formData.get("recencyDays")) ?? 60)),
  });

  revalidatePath("/for-you");
  revalidatePath("/jobs");
  revalidatePath("/profile");
}
