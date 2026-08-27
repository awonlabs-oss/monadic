import { getServerClient } from "@/lib/supabase/server";
import { CLOSED_STATUSES, type Status } from "@/lib/applications/pipeline";

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
