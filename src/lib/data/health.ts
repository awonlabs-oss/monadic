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
  /**
   * True when the read itself failed.
   *
   * The distinction matters more here than anywhere else in the app. Section 4
   * puts this footer on every screen because a silent pipeline failure is the
   * product's main failure mode, so a footer that answers "cannot tell" with
   * "0 boards · 0 failed" and a green dot would be the exact lie this component
   * exists to prevent.
   */
  unavailable?: boolean;
}

/**
 * What the footer shows when the database cannot be reached.
 *
 * Zeros, but flagged — the sidebar renders the flag, never the zeros.
 */
export const HEALTH_UNAVAILABLE: IngestionHealth = {
  lastSyncAt: null,
  boards: 0,
  failed: 0,
  unavailable: true,
};

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

/**
 * The shell's two reads, which must never take the whole app down with them.
 *
 * Every route renders inside the layout, so an exception in either of the
 * functions above is not a broken sidebar — it is a 500 on every page in the
 * application, including the ones that would have worked. It is also a build
 * failure: `/` and the not-found page are prerendered, which runs this layout,
 * which signs in to Supabase. That made a live database a prerequisite for
 * compiling the app, and a deploy fails at "Error occurred prerendering page
 * /" — a message that names the page rather than the cause.
 *
 * So the shell degrades instead. The nav loses its counts, the footer says it
 * does not know, and each page still succeeds or fails on its own terms.
 */
export async function shellHealth(): Promise<IngestionHealth> {
  try {
    return await ingestionHealth();
  } catch {
    return HEALTH_UNAVAILABLE;
  }
}

export async function shellCounts(): Promise<{
  openJobs: number;
  tracked: number;
  saved: number;
}> {
  try {
    return await navCounts();
  } catch {
    // Zeros, and the Badge component renders nothing at zero — so the nav shows
    // no counts rather than claiming there are none.
    return { openJobs: 0, tracked: 0, saved: 0 };
  }
}
