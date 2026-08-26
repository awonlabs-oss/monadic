import { getServerClient } from "@/lib/supabase/server";
import { toRpcArgs, type JobFilters } from "@/lib/filters";

/**
 * The only place the app queries jobs.
 *
 * Filtering goes through the search_jobs function rather than being assembled
 * here, so the predicate exists once. The row count comes back on every row via
 * a window function, which means "showing 48 of 312" is computed from the same
 * evaluation of the same WHERE clause as the rows themselves and cannot drift.
 */

export interface JobListItem {
  id: string;
  company_name: string;
  company_slug: string;
  company_logo_url: string | null;
  title: string;
  url: string | null;
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
  total_count: number;
}

export async function searchJobs(
  filters: JobFilters,
  limit = 48,
  offset = 0,
): Promise<{ jobs: JobListItem[]; total: number }> {
  const db = await getServerClient();

  const { data, error } = await db.rpc("search_jobs", toRpcArgs(filters, limit, offset));
  if (error) throw new Error(`searchJobs: ${error.message}`);

  const jobs = (data ?? []) as unknown as JobListItem[];
  return { jobs, total: jobs[0]?.total_count ?? 0 };
}

export interface FeedStats {
  openJobs: number;
  companies: number;
}

export async function feedStats(): Promise<FeedStats> {
  const db = await getServerClient();

  const [open, companies] = await Promise.all([
    db.from("jobs").select("id", { count: "exact", head: true }).is("closed_at", null),
    db
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("ats_resolution_status", "resolved"),
  ]);

  return { openJobs: open.count ?? 0, companies: companies.count ?? 0 };
}
