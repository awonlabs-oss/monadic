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

/** Full figures, for the detail page's facts list: "$140,000 – $170,000". */
function exact(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatComp(
  job: {
    comp_min: number | null;
    comp_max: number | null;
    comp_currency: string | null;
    comp_period: string | null;
    comp_source: string;
  },
  /**
   * `precise` writes the figures out in full. The feed abbreviates because a
   * card is scanned; the detail page does not, because it is the page you read
   * before deciding, and "$169.2k" is a rounded number pretending to be the
   * posting's own.
   */
  options: { precise?: boolean } = {},
): Presence<string> {
  if (job.comp_source === "none" || (job.comp_min === null && job.comp_max === null)) {
    return { known: false, reason: "Not listed" };
  }

  const sym = currency(job.comp_currency);
  const per = job.comp_period && job.comp_period !== "year" ? ` / ${job.comp_period}` : "";
  const write = options.precise ? exact : short;

  // A band whose ends are equal is a single figure, not a range. 63 open
  // postings state one number, and "$320k – $320k" reads as a formatting fault
  // rather than as a fixed salary.
  const range =
    job.comp_min !== null && job.comp_max !== null && job.comp_min !== job.comp_max
      ? `${sym}${write(job.comp_min)} – ${sym}${write(job.comp_max)}`
      : `${sym}${write((job.comp_min ?? job.comp_max) as number)}`;

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

/**
 * Ultra-compact age, for card meta and the sidebar footer: "2d", "14m", "4h".
 * Distinct from relativeDays, which is prose for list rows.
 */
export function relativeShort(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Age with no "ago" — the card meta slot, which sits beside the company name. */
export function ageBadge(iso: string | null): string {
  return relativeShort(iso).replace(" ago", "");
}

/**
 * The card's date line: an absolute date with the elapsed time beside it, as in
 * "Posted Aug 25 [1 day ago]".
 *
 * Both halves earn their place. The date is what you quote when you talk to
 * someone about the role; the elapsed time is what you actually scan for when
 * deciding whether it is worth applying to. Either alone makes you compute the
 * other.
 *
 * "Seen" rather than "Posted" when the board supplied no publication date. On
 * the first pull of a new board every row shares first_seen_at, so labelling
 * that "Posted" would have every card claim to have been posted the day
 * ingestion happened to run.
 */
export function postedLabel(
  postedAt: string | null,
  firstSeenAt: string,
): { verb: "Posted" | "Seen"; date: string; elapsed: string } {
  const iso = postedAt ?? firstSeenAt;
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();

  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  let elapsed: string;
  if (days <= 0) elapsed = "today";
  else if (days === 1) elapsed = "1 day ago";
  else if (days < 30) elapsed = `${days} days ago`;
  else if (days < 60) elapsed = "1 month ago";
  else if (days < 365) elapsed = `${Math.floor(days / 30)} months ago`;
  else if (days < 730) elapsed = "1 year ago";
  else elapsed = `${Math.floor(days / 365)} years ago`;

  return {
    verb: postedAt ? "Posted" : "Seen",
    // "Aug 25", month first, and the year only when it is not this one.
    date: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    }),
    elapsed,
  };
}
