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
