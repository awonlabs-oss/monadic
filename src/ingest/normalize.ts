import type { CompPeriod, NormalizedJob, RemotePolicy } from "./types";

/**
 * Shared normalizers.
 *
 * These are deliberately crude and deliberately honest. Everything derived from
 * prose is marked compSource/yearsSource = "description" so the UI can say
 * where a number came from, and everything uncertain returns null rather than a
 * guess. A wrong salary shown confidently is worse than no salary shown.
 */

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 0 ? text : null;
}

const REMOTE_WORDS = /\b(remote|distributed|work from home|wfh|anywhere)\b/i;
const HYBRID_WORDS = /\bhybrid\b/i;
const ONSITE_WORDS = /\b(on-?site|in-?office|in-?person)\b/i;

/**
 * Best effort, and null when genuinely unclear. Note the ordering: a posting
 * saying "hybrid" while also saying "remote-friendly" is hybrid — the more
 * restrictive claim is the one that governs whether you can actually take it.
 */
export function remotePolicyFrom(...hints: Array<string | null | undefined>): RemotePolicy | null {
  const text = hints.filter(Boolean).join(" ");
  if (!text) return null;
  if (HYBRID_WORDS.test(text)) return "hybrid";
  if (ONSITE_WORDS.test(text)) return "onsite";
  if (REMOTE_WORDS.test(text)) return "remote";
  return null;
}

export function periodFrom(interval: string | null | undefined): CompPeriod | null {
  if (!interval) return null;
  const i = interval.toLowerCase();
  if (i.includes("year") || i.includes("annual")) return "year";
  if (i.includes("month")) return "month";
  if (i.includes("week")) return "week";
  if (i.includes("day")) return "day";
  if (i.includes("hour")) return "hour";
  return null;
}

/**
 * Pull a salary range out of description prose.
 *
 * Only used where the ATS gives nothing structured, which in practice means
 * Greenhouse. Requires two figures and a currency marker, and refuses anything
 * that does not look like an annual salary band, because the alternative is
 * confidently reporting an equity percentage or a 401k match as pay.
 */
const MONEY = String.raw`\$\s?(\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])`;
const RANGE_RE = new RegExp(`${MONEY}\\s*(?:-|–|—|to)\\s*${MONEY}`, "g");

function parseMoney(token: string): number | null {
  const cleaned = token.replace(/[$,\s]/g, "");
  if (/[kK]$/.test(cleaned)) {
    const n = Number(cleaned.slice(0, -1));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function compFromDescription(text: string | null): Pick<
  NormalizedJob,
  "compMin" | "compMax" | "compCurrency" | "compPeriod" | "compSource" | "compNote"
> {
  const none = {
    compMin: null,
    compMax: null,
    compCurrency: null,
    compPeriod: null,
    compSource: "none" as const,
    compNote: null,
  };
  if (!text) return none;

  for (const match of text.matchAll(RANGE_RE)) {
    const min = parseMoney(match[1]);
    const max = parseMoney(match[2]);
    if (min === null || max === null || min > max) continue;

    // Annual salary band, not an hourly rate or a signing bonus. Below 10k a
    // year is not a salary; above 2M is almost certainly a fund size or an ARR
    // figure that happened to sit near the word "compensation".
    if (min < 10_000 || max > 2_000_000) continue;

    const window = text.slice(Math.max(0, match.index - 120), match.index + 200);
    return {
      compMin: min,
      compMax: max,
      compCurrency: "USD",
      compPeriod: "year",
      compSource: "description",
      compNote: window.replace(/\s+/g, " ").trim().slice(0, 300),
    };
  }
  return none;
}

/**
 * Years of experience required, from the title or the description.
 *
 * An earlier version required the literal word "experience" within 40
 * characters of the figure. Measured against 2,380 real postings it missed 397
 * that plainly stated a requirement, because the common phrasings do not use
 * that word at all:
 *
 *   "3–5 years in a client-facing delivery role"
 *   "5+ years managing technical delivery"
 *   "7+ years in client-facing delivery, consulting, or enterprise software"
 *
 * So the anchor is now a window test in both directions: accept when the
 * surrounding text looks like a requirement, reject when it looks like one of
 * the phrases that reliably produces a false positive. Those matter — "over the
 * past 5 years", "vesting over 4 years" and "founded 6 years ago" all sit near
 * the word "years" in job descriptions, and reading any of them as a
 * requirement would put a confident wrong number on the card.
 */
const YEARS_RE =
  /(\d{1,2})\s*(?:\+|plus)?\s*(?:[-–—]|\s+to\s+)?\s*(\d{1,2})?\s*(?:\+)?\s*(?:years?|yrs?)\b/gi;

const REQUIREMENT_CONTEXT =
  /experience|background|proven|track record|minimum|at least|relevant|professional|industry|working|building|managing|leading|developing|designing|shipping|practicing|in\s+(?:a|an|the)\b|of\s+(?:engineering|software|product|design|data|sales|marketing|research|security|infrastructure)/i;

const FALSE_POSITIVE_CONTEXT =
  /(?:past|last|next|previous|recent|first)\s+\d{1,2}\s*(?:years?|yrs?)|\d{1,2}\s*(?:years?|yrs?)\s+ago|vest|founded|anniversar|over the (?:past|last)|every\s+\d{1,2}\s*years?|\d{1,2}\s*[-–]\s*year\s+(?:program|degree|visa)/i;

export function yearsFromText(text: string | null): Pick<
  NormalizedJob,
  "yearsMin" | "yearsMax" | "yearsSource"
> {
  const none = { yearsMin: null, yearsMax: null, yearsSource: "none" as const };
  if (!text) return none;

  for (const match of text.matchAll(YEARS_RE)) {
    const a = Number(match[1]);
    const b = match[2] ? Number(match[2]) : null;
    if (!Number.isFinite(a) || a < 0 || a > 40) continue;
    if (b !== null && (!Number.isFinite(b) || b < a || b > 40)) continue;

    const start = Math.max(0, match.index - 90);
    const window = text.slice(start, match.index + match[0].length + 120);

    if (FALSE_POSITIVE_CONTEXT.test(window)) continue;
    if (!REQUIREMENT_CONTEXT.test(window)) continue;

    return { yearsMin: a, yearsMax: b, yearsSource: "description" };
  }
  return none;
}

/**
 * Title first, then description. A title that states the requirement outright
 * ("Engineer, 5+ years") is more reliable than anything in the prose below it.
 */
export function yearsFromDescription(
  text: string | null,
  title?: string | null,
): Pick<NormalizedJob, "yearsMin" | "yearsMax" | "yearsSource"> {
  const fromTitle = title ? yearsFromText(title) : null;
  if (fromTitle && fromTitle.yearsSource !== "none") return fromTitle;
  return yearsFromText(text);
}

/**
 * Stable fingerprint of the fields we actually store, so an unchanged posting
 * is a last_seen_at bump instead of a full rewrite. Deliberately excludes raw:
 * ATSes churn ids and timestamps inside the payload on every request, and
 * hashing those would make every job look changed every run.
 */
export function contentHash(job: NormalizedJob): string {
  const material = JSON.stringify([
    job.title,
    job.url,
    job.department,
    job.team,
    job.employmentType,
    job.locationRaw,
    job.remotePolicy,
    job.compMin,
    job.compMax,
    job.compCurrency,
    job.compPeriod,
    job.yearsMin,
    job.yearsMax,
    job.descriptionText,
  ]);
  // FNV-1a. Not cryptographic — this only needs to detect change, not resist
  // an adversary, and avoiding a hash import keeps this module edge-safe.
  let h = 0x811c9dc5;
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
