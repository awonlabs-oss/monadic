import { getServerClient } from "@/lib/supabase/server";

/**
 * Ingestion health.
 *
 * This is the surface that answers "is the pipeline still working", which is
 * the question the runs table exists for. A puller that quietly returns nothing
 * is the main way something like this rots, and the only defence is being able
 * to see it.
 */

export interface RunRow {
  id: string;
  status: string;
  http_status: number | null;
  jobs_returned: number | null;
  jobs_created: number | null;
  jobs_updated: number | null;
  jobs_closed: number | null;
  closure_applied: boolean;
  duration_ms: number | null;
  started_at: string;
  error_message: string | null;
  source: string | null;
  company_name: string | null;
}

export async function recentRuns(limit = 40): Promise<RunRow[]> {
  const db = await getServerClient();

  const { data, error } = await db
    .from("ingestion_runs")
    // One literal, not concatenated — see the note in data/jobs.ts.
    .select(
      "id,status,http_status,jobs_returned,jobs_created,jobs_updated,jobs_closed,closure_applied,duration_ms,started_at,error_message,source,companies(name)",
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`recentRuns: ${error.message}`);

  return (data ?? []).map((row) => {
    const { companies, ...rest } = row as unknown as Omit<RunRow, "company_name"> & {
      companies: { name: string } | null;
    };
    return { ...rest, company_name: companies?.name ?? null };
  });
}

export interface CompanyHealth {
  id: string;
  name: string;
  slug: string;
  ats_source: string | null;
  ats_slug: string | null;
  ats_resolution_status: string;
  ats_resolution_method: string | null;
  ats_resolution_error: string | null;
  open_jobs: number;
}

export async function companyHealth(): Promise<CompanyHealth[]> {
  const db = await getServerClient();

  const { data: companies, error } = await db
    .from("companies")
    .select(
      "id,name,slug,ats_source,ats_slug,ats_resolution_status,ats_resolution_method,ats_resolution_error",
    )
    .order("name");
  if (error) throw new Error(`companyHealth: ${error.message}`);

  const { data: openJobs, error: jobsError } = await db
    .from("jobs")
    .select("company_id")
    .is("closed_at", null);
  if (jobsError) throw new Error(`companyHealth: ${jobsError.message}`);

  const counts = new Map<string, number>();
  for (const row of openJobs ?? []) {
    counts.set(row.company_id, (counts.get(row.company_id) ?? 0) + 1);
  }

  return (companies ?? []).map((c) => ({
    ...c,
    open_jobs: counts.get(c.id) ?? 0,
  })) as CompanyHealth[];
}
