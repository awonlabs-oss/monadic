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

export async function navCounts(): Promise<{ newJobs: number; tracked: number }> {
  const db = await getServerClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [newJobs, tracked] = await Promise.all([
    db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .is("closed_at", null)
      .gte("first_seen_at", weekAgo),
    db.from("applications").select("id", { count: "exact", head: true }),
  ]);

  return { newJobs: newJobs.count ?? 0, tracked: tracked.count ?? 0 };
}
