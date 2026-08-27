import { getServerClient } from "@/lib/supabase/server";
import { CLOSED_STATUSES } from "@/lib/applications/pipeline";

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
