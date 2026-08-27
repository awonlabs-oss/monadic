import { getServerClient } from "@/lib/supabase/server";

/**
 * Summary for the permanent sidebar footer.
 *
 * DESIGN.md section 4: the ingestion health footer is furniture, not a debug
 * panel. Silent pipeline failure is this product's main failure mode, so the
 * numbers stay on screen on every route.
 */
export interface IngestionHealth {
  lastSyncAt: string | null;
  boards: number;
  failed: number;
}

export async function ingestionHealth(): Promise<IngestionHealth> {
  const db = await getServerClient();

  const [last, boards, failed] = await Promise.all([
    db
      .from("ingestion_runs")
      .select("started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("ats_resolution_status", "resolved"),
    db
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("ats_resolution_status", "failed"),
  ]);

  return {
    lastSyncAt: last.data?.started_at ?? null,
    boards: boards.count ?? 0,
    failed: failed.count ?? 0,
  };
}

/**
 * The counts beside the nav items.
 *
 * openJobs is every open posting, not the ones first seen in the last week.
 * The week-long window was measuring ingestion rather than the world — every
 * posting here was first seen inside a single run, so "new this week" and "all
 * of them" were the same 6,675 and the badge said nothing. It also sat on For
 * You, which is a bounded ranked feed of about 25; a five-figure badge on it was
 * describing a different page. It belongs on All jobs, where a total is what
 * you would expect it to mean.
 */
export async function navCounts(): Promise<{ openJobs: number; tracked: number; saved: number }> {
  const db = await getServerClient();

  const [openJobs, tracked, saved] = await Promise.all([
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .is("closed_at", null),
    db.from("applications").select("id", { count: "exact", head: true }),
    db
      .from("job_interactions")
      .select("id", { count: "exact", head: true })
      .eq("state", "saved"),
  ]);

  return {
    openJobs: openJobs.count ?? 0,
    tracked: tracked.count ?? 0,
    saved: saved.count ?? 0,
  };
}
