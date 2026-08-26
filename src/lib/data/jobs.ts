import { getServerClient } from "@/lib/supabase/server";
import { toRpcArgs, toFacetArgs, type JobFilters } from "@/lib/filters";

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
  posted_at: string | null;
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

/**
 * Counts per filter option, with the other dimensions applied.
 *
 * These exist so the panel can show what a choice would actually yield.
 * A filter that silently leads to zero results is the standard way filter UI
 * wastes people's time, and a count is what shows the dead end beforehand.
 */
export interface JobDetail {
  id: string;
  title: string;
  url: string | null;
  department: string | null;
  team: string | null;
  employment_type: string | null;
  location_raw: string | null;
  location_cities: string[] | null;
  remote_policy: string | null;
  comp_min: number | null;
  comp_max: number | null;
  comp_currency: string | null;
  comp_period: string | null;
  comp_source: string;
  comp_note: string | null;
  years_min: number | null;
  years_max: number | null;
  years_source: string;
  description_html: string | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  closed_at: string | null;
  source: string;
  company: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    website_url: string | null;
  };
  interaction_state: string;
  application_id: string | null;
  other_open_roles: number;
}

/**
 * One posting, with everything the detail page shows.
 *
 * Not read through job_feed: that view exists to render a card and carries
 * neither the description nor the company's website, and widening it would make
 * every feed query haul a description column it never displays.
 *
 * The interaction and application lookups stay separate rather than joined.
 * Both are user-scoped and go through RLS on their own tables; folding them
 * into the job query would mean an outer join against tables the anon role
 * cannot see, which is a policy question rather than a query-shape one.
 */
export async function getJob(id: string): Promise<JobDetail | null> {
  const db = await getServerClient();

  const { data: job, error } = await db
    .from("jobs")
    .select(
      "id,company_id,title,url,department,team,employment_type,location_raw,location_cities,remote_policy,comp_min,comp_max,comp_currency,comp_period,comp_source,comp_note,years_min,years_max,years_source,description_html,posted_at,first_seen_at,last_seen_at,closed_at,source,companies(id,name,slug,logo_url,website_url)",
    )
    .eq("id", id)
    .maybeSingle();

  // A malformed uuid is a 400 from PostgREST rather than an empty result, and
  // it reaches here from a hand-edited URL. Treated as "no such job".
  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`getJob: ${error.message}`);
  }
  if (!job) return null;

  const row = job as unknown as Record<string, unknown>;
  const company = row.companies as JobDetail["company"] | null;
  if (!company) return null;

  const [interaction, application, siblings] = await Promise.all([
    db.from("job_interactions").select("state").eq("job_id", id).maybeSingle(),
    db.from("applications").select("id").eq("job_id", id).maybeSingle(),
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", row.company_id as string)
      .is("closed_at", null)
      .neq("id", id),
  ]);

  return {
    ...(row as unknown as Omit<
      JobDetail,
      "company" | "interaction_state" | "application_id" | "other_open_roles"
    >),
    company,
    interaction_state: (interaction.data?.state as string | undefined) ?? "none",
    application_id: (application.data?.id as string | undefined) ?? null,
    other_open_roles: siblings.count ?? 0,
  };
}

export type Facets = Record<string, Record<string, number>>;

export async function jobFacets(filters: JobFilters): Promise<Facets> {
  const db = await getServerClient();
  const { data, error } = await db.rpc("job_facets", toFacetArgs(filters));
  if (error) throw new Error(`jobFacets: ${error.message}`);

  const out: Facets = {};
  for (const row of (data ?? []) as Array<{ dimension: string; key: string; n: number }>) {
    (out[row.dimension] ??= {})[row.key] = Number(row.n);
  }
  return out;
}

export interface FeedStats {
  /** Open postings within the current geographic scope. */
  openJobs: number;
  /** Open postings ignoring scope, so the opt-out can say what it would add. */
  openJobsAllCountries: number;
  companies: number;
}

/**
 * Header counts.
 *
 * openJobs respects the US default. It has to: the feed is US-scoped out of the
 * box, and a header reading "2,380 open roles" above a list containing 1,618 of
 * them is simply wrong — and wrong in the direction that looks like postings
 * have gone missing.
 */
export async function feedStats(usOnly: boolean): Promise<FeedStats> {
  const db = await getServerClient();

  let scoped = db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .is("closed_at", null);
  if (usOnly) scoped = scoped.eq("us_eligible", true);

  const [open, all, companies] = await Promise.all([
    scoped,
    db.from("jobs").select("id", { count: "exact", head: true }).is("closed_at", null),
    db
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("ats_resolution_status", "resolved"),
  ]);

  return {
    openJobs: open.count ?? 0,
    openJobsAllCountries: all.count ?? 0,
    companies: companies.count ?? 0,
  };
}
