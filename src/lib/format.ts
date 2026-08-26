/**
 * Display helpers.
 *
 * The compensation and experience formatters return a discriminated result
 * rather than a string, because "not listed" and "$180k – $220k" are not the
 * same kind of thing and the UI needs to be able to treat them differently.
 * Collapsing both into a string is how an em dash ends up standing in for four
 * different meanings — the exact outcome DESIGN.md §7 rules out.
 */

export type Presence<T> =
  | { known: true; value: T; caveat: string | null }
  | { known: false; reason: string };

const currency = (code: string | null) =>
  code && code !== "USD" ? `${code} ` : "$";

function short(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}k`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

export function formatComp(job: {
  comp_min: number | null;
  comp_max: number | null;
  comp_currency: string | null;
  comp_period: string | null;
  comp_source: string;
}): Presence<string> {
  if (job.comp_source === "none" || (job.comp_min === null && job.comp_max === null)) {
    return { known: false, reason: "Not listed" };
  }

  const sym = currency(job.comp_currency);
  const per = job.comp_period && job.comp_period !== "year" ? ` / ${job.comp_period}` : "";

  const range =
    job.comp_min !== null && job.comp_max !== null
      ? `${sym}${short(job.comp_min)} – ${sym}${short(job.comp_max)}`
      : `${sym}${short((job.comp_min ?? job.comp_max) as number)}`;

  return {
    known: true,
    value: `${range}${per}`,
    // Read out of description prose rather than a structured field, so it is
    // worth saying so instead of presenting it with the same confidence.
    caveat: job.comp_source === "description" ? "from description" : null,
  };
}

export function formatYears(job: {
  years_min: number | null;
  years_max: number | null;
  years_source: string;
}): Presence<string> {
  if (job.years_source === "none" || job.years_min === null) {
    return { known: false, reason: "Not stated" };
  }
  const value =
    job.years_max !== null && job.years_max !== job.years_min
      ? `${job.years_min}–${job.years_max} yrs`
      : `${job.years_min}+ yrs`;
  return {
    known: true,
    value,
    caveat: job.years_source === "description" ? "from description" : null,
  };
}

export function formatRemote(policy: string | null): Presence<string> {
  if (!policy) return { known: false, reason: "Not stated" };
  const labels: Record<string, string> = {
    remote: "Remote",
    hybrid: "Hybrid",
    onsite: "On-site",
  };
  return { known: true, value: labels[policy] ?? policy, caveat: null };
}

/** Coarse on purpose — the feed is scanned, and an exact timestamp is noise. */
export function relativeDays(iso: string | null): string {
  if (!iso) return "unknown";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
