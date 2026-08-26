/**
 * Feed filters, encoded in the URL.
 *
 * State lives in searchParams and nowhere else, so a filtered feed is
 * shareable, bookmarkable, survives reload, and needs no client-side store.
 * Every control renders as a link or a GET form.
 *
 * Both years and pay carry an explicit include-unknown flag, defaulting to
 * included. 30% of postings state no years and 59% state no pay; a filter that
 * silently dropped them would hide most of the feed the moment you touched it,
 * and would read as broken ingestion rather than as a filter doing its job.
 */

export interface JobFilters {
  q: string | null;
  years: string | null;
  comp: string | null;
  remote: string[];
  company: string | null;
  includeYearsUnknown: boolean;
  includeCompUnknown: boolean;
  searchDescriptions: boolean;
}

export const YEARS_BUCKETS = [
  { key: "0-2", label: "0–2 yrs", min: 0, max: 2 },
  { key: "3-5", label: "3–5 yrs", min: 3, max: 5 },
  { key: "6-9", label: "6–9 yrs", min: 6, max: 9 },
  { key: "10", label: "10+ yrs", min: 10, max: null },
] as const;

export const COMP_BUCKETS = [
  { key: "100", label: "$100k+", min: 100_000 },
  { key: "150", label: "$150k+", min: 150_000 },
  { key: "200", label: "$200k+", min: 200_000 },
  { key: "250", label: "$250k+", min: 250_000 },
] as const;

export const REMOTE_OPTIONS = [
  { key: "remote", label: "Remote" },
  { key: "hybrid", label: "Hybrid" },
  { key: "onsite", label: "On-site" },
] as const;

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | null =>
  (Array.isArray(v) ? v[0] : v)?.trim() || null;

export function parseFilters(params: RawParams): JobFilters {
  const remote = one(params.remote);
  return {
    q: one(params.q),
    years: YEARS_BUCKETS.some((b) => b.key === one(params.years)) ? one(params.years) : null,
    comp: COMP_BUCKETS.some((b) => b.key === one(params.comp)) ? one(params.comp) : null,
    remote: (remote?.split(",") ?? []).filter((r) =>
      REMOTE_OPTIONS.some((o) => o.key === r),
    ),
    company: one(params.company),
    // Absent means included. Only an explicit "0" excludes.
    includeYearsUnknown: one(params.yrsunk) !== "0",
    includeCompUnknown: one(params.compunk) !== "0",
    // Off by default: including descriptions turns "engineer" from 770 matches
    // into 1,907, which is 80% of the corpus and not a filter.
    searchDescriptions: one(params.desc) === "1",
  };
}

/** Arguments for the search_jobs RPC. */
export function toRpcArgs(filters: JobFilters, limit: number, offset = 0) {
  const years = YEARS_BUCKETS.find((b) => b.key === filters.years);
  const comp = COMP_BUCKETS.find((b) => b.key === filters.comp);

  // Omitted rather than null: PostgREST types optional arguments as
  // `T | undefined`, and an absent argument takes the function's own default,
  // which is the same null we would otherwise be spelling out.
  return {
    p_query: filters.q ?? undefined,
    p_years_min: years?.min ?? undefined,
    p_years_max: years?.max ?? undefined,
    p_include_years_unknown: filters.includeYearsUnknown,
    p_comp_min: comp?.min ?? undefined,
    p_include_comp_unknown: filters.includeCompUnknown,
    p_remote: filters.remote.length > 0 ? filters.remote : undefined,
    p_company: filters.company ?? undefined,
    p_saved_only: false,
    p_search_descriptions: filters.searchDescriptions,
    p_limit: limit,
    p_offset: offset,
  };
}

/**
 * Builds the href for toggling one filter, preserving everything else. Setting
 * a value to its current value clears it, so every pill toggles off.
 */
export function toggleHref(
  current: JobFilters,
  change: Partial<Record<"q" | "years" | "comp" | "company" | "yrsunk" | "compunk" | "desc", string | null>> & {
    remote?: string;
  },
): string {
  const params = new URLSearchParams();

  const q = "q" in change ? change.q : current.q;
  if (q) params.set("q", q);

  const years = "years" in change ? change.years : current.years;
  if (years) params.set("years", years);

  const comp = "comp" in change ? change.comp : current.comp;
  if (comp) params.set("comp", comp);

  const company = "company" in change ? change.company : current.company;
  if (company) params.set("company", company);

  let remote = current.remote;
  if (change.remote) {
    remote = remote.includes(change.remote)
      ? remote.filter((r) => r !== change.remote)
      : [...remote, change.remote];
  }
  if (remote.length > 0) params.set("remote", remote.join(","));

  const yrsunk =
    "yrsunk" in change ? change.yrsunk : current.includeYearsUnknown ? null : "0";
  if (yrsunk === "0") params.set("yrsunk", "0");

  const compunk =
    "compunk" in change ? change.compunk : current.includeCompUnknown ? null : "0";
  if (compunk === "0") params.set("compunk", "0");

  const desc = "desc" in change ? change.desc : current.searchDescriptions ? "1" : null;
  if (desc === "1") params.set("desc", "1");

  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

export function activeCount(filters: JobFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.years ? 1 : 0) +
    (filters.comp ? 1 : 0) +
    (filters.company ? 1 : 0) +
    filters.remote.length +
    (filters.includeYearsUnknown ? 0 : 1) +
    (filters.includeCompUnknown ? 0 : 1)
  );
}
