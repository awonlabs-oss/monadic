import type { CompPeriod, NormalizedJob, RemotePolicy } from "./types";

/**
 * Shared normalizers.
 *
 * These are deliberately crude and deliberately honest. Everything derived from
 * prose is marked compSource/yearsSource = "description" so the UI can say
 * where a number came from, and everything uncertain returns null rather than a
 * guess. A wrong salary shown confidently is worse than no salary shown.
 */

/**
 * The named entities that actually appear in ATS-authored HTML.
 *
 * Not a complete HTML5 table — that is ~2,200 names, and pulling in a library
 * for it would be a dependency for a rounding error. This is the set that shows
 * up in real postings, and anything unrecognised is left as written rather than
 * mangled, so an unknown entity degrades to a visible `&frac13;` instead of a
 * silently wrong character.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", minus: "−", hellip: "…", bull: "•", middot: "·",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  laquo: "«", raquo: "»", sbquo: "‚", bdquo: "„",
  reg: "®", copy: "©", trade: "™", sect: "§", para: "¶", dagger: "†", Dagger: "‡",
  euro: "€", pound: "£", yen: "¥", cent: "¢",
  frac12: "½", frac14: "¼", frac34: "¾", plusmn: "±", times: "×", divide: "÷",
  deg: "°", ne: "≠", le: "≤", ge: "≥", prime: "′", Prime: "″",
  eacute: "é", egrave: "è", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä",
  aacute: "á", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", szlig: "ß",
};

/**
 * Decodes HTML entities, all three forms: named, decimal and hexadecimal.
 *
 * This is not cosmetic. `&mdash;` is what Greenhouse writes between the two
 * halves of a salary band, and leaving it encoded meant the compensation
 * regex — which looks for a dash — could not see a range that was plainly
 * there. Measured across the open feed: 1,158 postings carried an undecoded
 * entity and 1,154 of them had no compensation extracted. Decoding recovers
 * 1,031 salary bands.
 *
 * Hexadecimal was the other gap: the old version handled `&#8212;` but not
 * `&#x2014;`, which is the same character.
 *
 * fromCodePoint rather than fromCharCode, so an entity above the BMP (emoji
 * appear in perks sections) produces one character instead of a broken pair.
 */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (m, hex: string) => {
      const code = parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&#(\d+);/g, (m, dec: string) => {
      const code = Number(dec);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]{1,10});/g, (m, name: string) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : m,
    );
}

export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  // Tags first, entities second. The other order lets an encoded `&lt;script`
  // decode into something the tag stripper has already walked past.
  const text = decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
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

/**
 * What immediately follows the figure.
 *
 * This is the strongest signal there is and the old version did not use it. A
 * requirement almost always continues straight into the thing the years are in:
 * "7+ years in application security", "4+ years as a Sales Engineer", "8+ years
 * of success driving new business". The preposition is the anchor.
 *
 * The old anchor demanded an article — `in\s+(?:a|an|the)` — so every one of
 * those bare-noun phrasings fell through, and "as" was not there at all. That
 * single gap accounted for most of the 368 postings that stated a requirement
 * the extractor could not see.
 */
const REQUIREMENT_SUFFIX =
  /^\s*['’]?s?\s*(?:\+|plus)?\s*(?:of\s+)?(?:experience|exp\b|in\b|as\b|with\b|of\b|working|building|leading|managing|developing|designing|shipping|running|driving|supporting|delivering|owning|architecting|scaling)/i;

/**
 * What precedes it. Section headings are included because a bullet under
 * "Preferred qualifications" or "WHAT YOU'LL NEED" is a requirement no matter
 * how the sentence is phrased.
 */
const REQUIREMENT_CONTEXT =
  /experience|background|proven|track record|minimum|at least|relevant|professional|industry|working|building|managing|leading|developing|designing|shipping|practicing|qualification|requirement|must[- ]have|nice[- ]to[- ]have|you'?ll need|we'?re looking for|good fit if|love to hear from you|about you|who you are|what you bring|in\s+(?:a|an|the)\b|of\s+(?:engineering|software|product|design|data|sales|marketing|research|security|infrastructure)/i;

/**
 * Phrases that put a number beside the word "years" without stating a
 * requirement. These matter more now that the suffix test accepts a bare
 * preposition: "Paid Sabbatical Leave after 5 years of employment" reads as
 * "5 years of" and would otherwise land on the card as a requirement.
 *
 * The founder biography is the one that did real damage. "Before founding
 * Sierra, Clay spent 18 years at Google" sits in the company boilerplate at the
 * top of every posting that company publishes, so it beat the genuine
 * requirement further down and rewrote 2–6 yrs as 18. It is why `at` came back
 * out of the suffix list, and why "spent N years" is called out here: a
 * biography is the one place a large, confident, wrong number comes from.
 *
 * It is matched by that phrasing and not by the word "founder", which was the
 * first attempt and cost 57 correct extractions: "7+ years in product
 * management, founder/operator roles, growth" and "5+ years supporting Founder
 * or C-suite executives" are requirements that happen to contain the word.
 */
const FALSE_POSITIVE_CONTEXT =
  /(?:past|last|next|previous|recent|first)\s+\d{1,2}\s*(?:years?|yrs?)|\d{1,2}\s*(?:years?|yrs?)\s+ago|vest|founded\s+(?:in\s+\d{4}|by)|anniversar|sabbatical|over the (?:past|last)|every\s+\d{1,2}\s*years?|\d{1,2}\s*[-–]\s*year\s+(?:program|degree|visa)|after\s+\d{1,2}\s*(?:years?|yrs?)\s+of\s+(?:employment|service|tenure|continuous)|within\s+\d{1,2}\s*(?:years?|yrs?)\s+of\s+(?:graduation|graduating)|\d{1,2}\s*(?:years?|yrs?)\s+of\s+(?:age|the\s+company)|spent\s+(?:over\s+|nearly\s+|almost\s+)?\d{1,2}\s*(?:years?|yrs?)|\d{1,2}\s*(?:years?|yrs?)\s+at\s+[A-Z]|(?:veteran|previously|prior to)\b[^.]{0,40}\d{1,2}\s*(?:years?|yrs?)/i;

export function yearsFromText(text: string | null): Pick<
  NormalizedJob,
  "yearsMin" | "yearsMax" | "yearsSource"
> {
  const none = { yearsMin: null, yearsMax: null, yearsSource: "none" as const };
  if (!text) return none;

  // The first qualifying figure wins, and that is not laziness — it is how
  // these postings are written. The headline bar is stated first and anything
  // after it is a subset of it:
  //
  //   "7+ years' experience building mobile applications, including 2+ years
  //    of experience with React Native"
  //   "8+ years professional experience, including 4+ years of sales engineering"
  //   "Minimum 6+ years industry experience ... with at least 3 years in a
  //    leadership role"
  //
  // Ranking candidates by how strong their anchors look picks the second figure
  // in every one of those, because the subordinate clause is the one phrased as
  // "N years of experience". Measured across the feed it downgraded 7 to 2, 8
  // to 4 and 6 to 3 — the requirement is the first number, every time.
  //
  // Boilerplate above the requirements is the risk this ordering carries, and
  // it is handled where it belongs, in FALSE_POSITIVE_CONTEXT.
  for (const match of text.matchAll(YEARS_RE)) {
    const a = Number(match[1]);
    const b = match[2] ? Number(match[2]) : null;
    if (!Number.isFinite(a) || a < 0 || a > 40) continue;
    if (b !== null && (!Number.isFinite(b) || b < a || b > 40)) continue;

    const end = match.index + match[0].length;
    const window = text.slice(Math.max(0, match.index - 90), end + 120);

    // Checked first and against the whole window: a false positive that also
    // happens to sit near a requirement word is still a false positive.
    if (FALSE_POSITIVE_CONTEXT.test(window)) continue;

    // Either anchor is enough. The suffix is the more reliable of the two, so
    // it is allowed to carry a match on its own — a bullet reading "5+ years in
    // distributed systems" needs no heading above it to be unambiguous.
    const hasSuffix = REQUIREMENT_SUFFIX.test(text.slice(end, end + 40));
    if (!hasSuffix && !REQUIREMENT_CONTEXT.test(window)) continue;

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
