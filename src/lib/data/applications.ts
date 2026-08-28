import { getServerClient } from "@/lib/supabase/server";
import { CLOSED_STATUSES, hasApplied, type Status } from "@/lib/applications/pipeline";

/**
 * The only place the app queries applications.
 *
 * Reads go through application_overview, which is security_invoker, so RLS
 * still applies exactly as it does everywhere else.
 */

export interface ApplicationRow {
  id: string;
  job_id: string;
  status: string;
  status_changed_at: string;
  applied_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
  job_title: string;
  job_url: string | null;
  job_closed_at: string | null;
  company_name: string;
  company_slug: string;
  company_logo_url: string | null;
  /** Only selected by getApplication — the hub needs it to find colleagues. */
  company_id?: string | null;
  last_event_at: string | null;
  event_count: number | null;
  days_in_stage: number | null;
  next_action_overdue: boolean | null;
}

const COLUMNS =
  "id,job_id,status,status_changed_at,applied_at,next_action,next_action_at,job_title,job_url,job_closed_at,company_name,company_slug,company_logo_url,last_event_at,event_count,days_in_stage,next_action_overdue";

export async function listApplications(options: { includeClosed?: boolean } = {}): Promise<{
  applications: ApplicationRow[];
  closedCount: number;
}> {
  const db = await getServerClient();

  const { data, error } = await db
    .from("application_overview")
    .select(COLUMNS)
    // Oldest first within a column: the thing that has been sitting longest is
    // the thing most likely to need something, so it should not be buried.
    .order("status_changed_at", { ascending: true });

  if (error) throw new Error(`listApplications: ${error.message}`);

  const all = (data ?? []) as unknown as ApplicationRow[];
  const closed = all.filter((a) => (CLOSED_STATUSES as string[]).includes(a.status));

  return {
    applications: options.includeClosed
      ? all
      : all.filter((a) => !(CLOSED_STATUSES as string[]).includes(a.status)),
    closedCount: closed.length,
  };
}

/**
 * The jobs already applied to, as a set the feed can ask about cheaply.
 *
 * The feed's own query cannot answer this. search_jobs returns
 * interaction_state, which is only ever none/saved/dismissed, and
 * application_id, which says a row exists rather than what stage it is at — so
 * a job applied to two weeks ago is indistinguishable there from one bookmarked
 * this morning. Teaching the RPC about status would be a migration to every
 * feed surface; one small keyed read per page render is the cheaper answer, and
 * the table is per-user and bounded by how many jobs one person tracks.
 */
export async function appliedJobIds(): Promise<Set<string>> {
  const db = await getServerClient();

  const { data, error } = await db
    .from("applications")
    .select("job_id, status, applied_at");
  if (error) throw new Error(`appliedJobIds: ${error.message}`);

  const out = new Set<string>();
  for (const row of (data ?? []) as Array<{
    job_id: string;
    status: string;
    applied_at: string | null;
  }>) {
    if (hasApplied(row)) out.add(row.job_id);
  }
  return out;
}

/**
 * One application, by its own id.
 *
 * Reads the same view the board does rather than the table, so a row here and a
 * row on the board carry identical derived fields — days_in_stage,
 * next_action_overdue — and the outreach hub cannot disagree with the list it
 * was opened from about whether something needs attention.
 */
export async function getApplication(id: string): Promise<ApplicationRow | null> {
  const db = await getServerClient();

  const { data, error } = await db
    .from("application_overview")
    .select(`${COLUMNS},company_id`)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // A hand-edited URL gives a malformed uuid, which PostgREST returns as a
    // 400 rather than an empty result. That is a 404, not a 500.
    if (error.code === "22P02") return null;
    throw new Error(`getApplication: ${error.message}`);
  }
  if (!data) return null;
  return data as unknown as ApplicationRow;
}

/** The timeline for one application. Append-only, so this is the whole history. */
export interface TimelineEvent {
  id: string;
  event_type: string;
  occurred_at: string;
  from_status: string | null;
  to_status: string | null;
  title: string | null;
  body: string | null;
}

export async function applicationTimeline(applicationId: string): Promise<TimelineEvent[]> {
  const db = await getServerClient();

  const { data, error } = await db
    .from("application_events")
    .select("id,event_type,occurred_at,from_status,to_status,title,body")
    .eq("application_id", applicationId)
    .order("occurred_at", { ascending: false });

  if (error) throw new Error(`applicationTimeline: ${error.message}`);
  return (data ?? []) as TimelineEvent[];
}

/**
 * Save: bookmark a job and put it on the board, in one write.
 *
 * Lives here rather than in the server action because two callers need it —
 * the action, which still backs the no-JS form path, and the route handler the
 * Save button posts to. Keeping one implementation is what stops the two from
 * disagreeing about what "saved" means.
 *
 * Both writes still happen. The interaction is what the feed reads to render
 * the button and what the sidebar's "Saved jobs" view filters on; the
 * application is the board row. Dropping either would break a surface that
 * currently works.
 *
 * Not atomic across the two, and it does not need to be: each RPC is atomic
 * with the row it owns, and the failure mode is a bookmark without a board
 * entry, which the next press repairs.
 */
export async function saveJob(jobId: string): Promise<void> {
  const db = await getServerClient();

  const { error } = await db.rpc("save_job", { p_job_id: jobId });
  if (error) throw new Error(`Could not save job: ${error.message}`);

  const { error: applicationError } = await db.rpc("create_application", {
    p_job_id: jobId,
    p_source: "job_feed",
  });

  // A second Save on the same job hits the unique (user_id, job_id) index.
  // That is the constraint doing its job, not a failure worth showing.
  if (applicationError && !/duplicate key|unique/i.test(applicationError.message)) {
    throw new Error(`Could not track job: ${applicationError.message}`);
  }
}

/**
 * Move an application to a status.
 *
 * Thin, and here rather than only in the server action for the same reason
 * saveJob is: the status picker posts to a route handler, and two copies of
 * this call would eventually disagree about which RPC writes the timeline.
 */
export async function setApplicationStatus(
  applicationId: string,
  status: Status,
): Promise<void> {
  const db = await getServerClient();
  const { error } = await db.rpc("set_application_status", {
    p_application_id: applicationId,
    p_status: status,
  });
  if (error) throw new Error(`Could not change status: ${error.message}`);
}

/**
 * Applying from a card: make sure the job is tracked, then mark it applied.
 *
 * Pressing Apply used to do nothing but open the company's board, so a job you
 * had actually applied to still sat in Saved until you remembered to move it.
 * The press is the strongest signal the app ever gets about intent, and it was
 * being thrown away.
 *
 * saveJob first because Apply is reachable on a job that was never saved, and
 * a status cannot be set on an application that does not exist yet. Both RPCs
 * are idempotent, so pressing Apply twice is not a second row.
 *
 * It is a claim about intent, not proof of submission — you might close the tab
 * without finishing. That is the right trade: the status picker is one click
 * away and reversible, whereas a job silently left in Saved is a job you think
 * you have not applied to.
 */
export async function markJobApplied(jobId: string): Promise<void> {
  await saveJob(jobId);

  const db = await getServerClient();
  const { data, error } = await db
    .from("applications")
    .select("id, status")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(`Could not find the application: ${error.message}`);
  if (!data) throw new Error("No application exists for that job");

  // Never walk a live process backwards. Someone at Onsite pressing Apply
  // again — to re-read the posting — must not be dropped back to Applied.
  if (data.status !== "shortlisted") return;

  await setApplicationStatus(data.id, "applied");
}

/**
 * Remove a tracked application entirely.
 *
 * The bookmark goes with it. Save writes both an interaction and an
 * application, and the feed reads the interaction to decide whether a card says
 * Save or Saved — so deleting only the application would leave a job still
 * reading "Saved" that had nothing behind it, and pressing Save again would
 * silently rebuild the row you just removed.
 *
 * The timeline goes too, by cascade. application_events is append-only and has
 * no DELETE policy, which is what stops history being edited; a cascade is a
 * referential action rather than a statement against that table, so removing
 * the whole application takes its events without contradicting the rule. The
 * distinction is the point — you cannot rewrite what happened, you can only
 * discard the whole record of it.
 *
 * The job itself is untouched. It is a global row that ingestion owns and other
 * things may reference, and deleting a tracked item is a statement about your
 * pipeline, not about whether the posting exists.
 */
export async function deleteApplication(applicationId: string): Promise<boolean> {
  const db = await getServerClient();

  const { data: app, error: readError } = await db
    .from("applications")
    .select("id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (readError) throw new Error(`Could not find that application: ${readError.message}`);
  // Absent is not an error — it is the outcome the caller asked for, and a row
  // already gone (a second press, a stale tab) should read as 404, not as a
  // failure. The route distinguishes the two.
  if (!app) return false;

  const { error } = await db.from("applications").delete().eq("id", applicationId);
  if (error) throw new Error(`Could not delete: ${error.message}`);

  // After the application, so a failure here leaves a bookmark without a board
  // entry — the state Save already repairs — rather than the reverse.
  const { error: bookmarkError } = await db
    .from("job_interactions")
    .delete()
    .eq("job_id", app.job_id);
  if (bookmarkError) throw new Error(`Could not clear the bookmark: ${bookmarkError.message}`);

  return true;
}
