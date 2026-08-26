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

/**
 * Recency windows. These select a subset rather than reorder one, so they are
 * filters despite reading like a sort. The feed keeps a single ordering
 * underneath: newest posted first.
 */
export const RECENCY = [
  { key: "1", label: "Posted today", days: 1 },
  { key: "7", label: "Past week", days: 7 },
  { key: "30", label: "Past month", days: 30 },
] as const;

export interface JobFilters {
  q: string | null;
  recency: string | null;
  cities: string[];
  usOnly: boolean;
  diversify: boolean;
  page: number;
  years: string | null;
  comp: string | null;
  remote: string[];
  companies: string[];
  includeYearsUnknown: boolean;
  includeCompUnknown: boolean;
  searchDescriptions: boolean;
  panelOpen: boolean;
  savedOnly: boolean;
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

/**
 * Last occurrence, not first.
 *
 * An unchecked HTML checkbox submits nothing at all, so there is no way to tell
 * "unchecked" from "never rendered". The fix is a hidden field carrying the off
 * value immediately before the checkbox: unchecked submits just the hidden one,
 * checked submits both, and the later value wins. That only works if the reader
 * takes the last, which is why this exists alongside one().
 */
const last = (v: string | string[] | undefined): string | null =>
  (Array.isArray(v) ? v[v.length - 1] : v)?.trim() || null;

export function parseFilters(params: RawParams): JobFilters {
  const remote = one(params.remote);
  const page = Number(one(params.page) ?? "1");
  return {
    q: one(params.q),
    recency: RECENCY.some((r) => r.key === one(params.recency)) ? one(params.recency) : null,
    cities: (Array.isArray(params.city) ? params.city : one(params.city)?.split(",") ?? [])
      .map((c) => c.trim())
      .filter(Boolean),
    // US-only by default. 762 of 2,380 open postings are elsewhere.
    usOnly: one(params.intl) !== "1",
    // On by default. Strict newest-first is dominated by whoever posts most:
    // one company with 400 roles outranks ninety posting three each.
    diversify: one(params.mix) !== "0",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    years: YEARS_BUCKETS.some((b) => b.key === one(params.years)) ? one(params.years) : null,
    comp: COMP_BUCKETS.some((b) => b.key === one(params.comp)) ? one(params.comp) : null,
    // Comma-joined from a link, repeated from the panel's checkboxes.
    remote: (Array.isArray(params.remote)
      ? params.remote
      : (remote?.split(",") ?? [])
    ).filter((r) => REMOTE_OPTIONS.some((o) => o.key === r)),
    companies: (Array.isArray(params.company)
      ? params.company
      : one(params.company)?.split(",") ?? []
    ).map((c) => c.trim()).filter(Boolean),
    // Absent means included. Only an explicit "0" excludes.
    includeYearsUnknown: last(params.yrsunk) !== "0",
    includeCompUnknown: last(params.compunk) !== "0",
    // Off by default: including descriptions turns "engineer" from 770 matches
    // into 1,907, which is 80% of the corpus and not a filter.
    searchDescriptions: one(params.desc) === "1",
    panelOpen: one(params.panel) === "1",
    savedOnly: one(params.saved) === "1",
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
    p_companies: filters.companies.length > 0 ? filters.companies : undefined,
    p_saved_only: filters.savedOnly,
    p_search_descriptions: filters.searchDescriptions,
    p_cities: filters.cities.length > 0 ? filters.cities : undefined,
    p_us_only: filters.usOnly,
    p_posted_within: RECENCY.find((r) => r.key === filters.recency)?.days ?? undefined,
    p_diversify: filters.diversify,
    // Two, not one: one collapses the feed to a single role per company, which
    // is a different product. Two roughly doubles the companies on a page —
    // measured at 18 against 13 for strict date order — while the feed still
    // reads as a list of roles.
    p_per_company: 2,
    p_limit: limit,
    p_offset: offset,
  };
}

/** Arguments for the job_facets RPC — the same predicate, without paging. */
export function toFacetArgs(filters: JobFilters) {
  const years = YEARS_BUCKETS.find((b) => b.key === filters.years);
  const comp = COMP_BUCKETS.find((b) => b.key === filters.comp);
  return {
    p_query: filters.q ?? undefined,
    p_years_min: years?.min ?? undefined,
    p_years_max: years?.max ?? undefined,
    p_include_years_unknown: filters.includeYearsUnknown,
    p_comp_min: comp?.min ?? undefined,
    p_include_comp_unknown: filters.includeCompUnknown,
    p_remote: filters.remote.length > 0 ? filters.remote : undefined,
    p_companies: filters.companies.length > 0 ? filters.companies : undefined,
    p_search_descriptions: filters.searchDescriptions,
    p_cities: filters.cities.length > 0 ? filters.cities : undefined,
    p_us_only: filters.usOnly,
    p_posted_within: RECENCY.find((r) => r.key === filters.recency)?.days ?? undefined,
  };
}

/**
 * Serialises filters back to a querystring. Paging is dropped on any filter
 * change, because staying on page 7 of a result set that just became 30 items
 * long lands you on an empty page.
 */
export function hrefFor(
  filters: JobFilters,
  overrides: Partial<JobFilters> = {},
): string {
  const f = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.years) params.set("years", f.years);
  if (f.comp) params.set("comp", f.comp);
  if (f.companies.length > 0) params.set("company", f.companies.join(","));
  if (f.remote.length > 0) params.set("remote", f.remote.join(","));
  if (!f.includeYearsUnknown) params.set("yrsunk", "0");
  if (!f.includeCompUnknown) params.set("compunk", "0");
  if (f.searchDescriptions) params.set("desc", "1");
  if (f.recency) params.set("recency", f.recency);
  if (f.cities.length > 0) params.set("city", f.cities.join(","));
  if (!f.usOnly) params.set("intl", "1");
  if (!f.diversify) params.set("mix", "0");
  if (f.panelOpen) params.set("panel", "1");
  if (f.savedOnly) params.set("saved", "1");
  if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
  const query = params.toString();
  return query ? `/jobs?${query}` : "/jobs";
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
    filters.companies.length +
    filters.remote.length +
    (filters.includeYearsUnknown ? 0 : 1) +
    (filters.includeCompUnknown ? 0 : 1) +
    (filters.savedOnly ? 1 : 0) +
    (filters.recency ? 1 : 0) +
    filters.cities.length +
    (filters.usOnly ? 0 : 1)
  );
}
