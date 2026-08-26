import { getServerClient } from "@/lib/supabase/server";

/**
 * The only place the app queries jobs.
 *
 * Reads go through the job_feed view, which already joins company and the
 * current user's interaction state and is declared security_invoker, so RLS
 * still applies. Routes and components never build queries themselves — that is
 * what keeps the policy surface to one auditable layer.
 */

export interface JobListItem {
  id: string;
  title: string;
  url: string | null;
  company_name: string;
  company_slug: string;
  source: string;
  department: string | null;
  employment_type: string | null;
  location_raw: string | null;
  remote_policy: string | null;
  comp_min: number | null;
  comp_max: number | null;
  comp_currency: string | null;
  comp_period: string | null;
  comp_source: string;
  years_min: number | null;
  years_max: number | null;
  years_source: string;
  first_seen_at: string;
  interaction_state: string;
  application_id: string | null;
}

// Written as one literal, not concatenated: supabase-js infers the row type
// from the select string at the type level, and `a + b` widens it to `string`,
// which silently degrades the result to an untyped error shape.
const LIST_COLUMNS =
  "id,title,url,company_name,company_slug,source,department,employment_type,location_raw,remote_policy,comp_min,comp_max,comp_currency,comp_period,comp_source,years_min,years_max,years_source,first_seen_at,interaction_state,application_id";

export async function listJobs(options: {
  limit?: number;
  company?: string | null;
} = {}): Promise<{ jobs: JobListItem[]; total: number }> {
  const db = await getServerClient();
  const limit = options.limit ?? 50;

  let query = db
    .from("job_feed")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("is_open", true)
    .neq("interaction_state", "dismissed")
    .order("first_seen_at", { ascending: false })
    .limit(limit);

  if (options.company) query = query.eq("company_slug", options.company);

  const { data, error, count } = await query;
  if (error) throw new Error(`listJobs: ${error.message}`);

  return { jobs: (data ?? []) as unknown as JobListItem[], total: count ?? 0 };
}

export interface FeedStats {
  openJobs: number;
  companies: number;
  withComp: number;
  addedThisWeek: number;
}

/**
 * Counts for the feed header. `withComp` is here because the share of postings
 * that state pay is a fact worth seeing constantly rather than discovering by
 * scrolling — it is currently well under half.
 */
export async function feedStats(): Promise<FeedStats> {
  const db = await getServerClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [open, companies, withComp, recent] = await Promise.all([
    db.from("jobs").select("id", { count: "exact", head: true }).is("closed_at", null),
    db.from("companies").select("id", { count: "exact", head: true }).eq("ats_resolution_status", "resolved"),
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .is("closed_at", null)
      .neq("comp_source", "none"),
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .is("closed_at", null)
      .gte("first_seen_at", weekAgo),
  ]);

  return {
    openJobs: open.count ?? 0,
    companies: companies.count ?? 0,
    withComp: withComp.count ?? 0,
    addedThisWeek: recent.count ?? 0,
  };
}
