import Anthropic from "@anthropic-ai/sdk";
import { SOURCES } from "./sources";
import { fetchJson } from "./http";
import {
  stripHtml,
  compFromDescription,
  yearsFromDescription,
  remotePolicyFrom,
} from "./normalize";
import { anthropicApiKey, ingestEnv } from "@/lib/env";
import type { BoardSource, NormalizedJob } from "./types";

/**
 * Turning a pasted link into the same row ingestion would have written.
 *
 * "The same" is meant literally where it can be. A Greenhouse, Ashby or Lever
 * posting URL carries the board slug and the posting id, so the link is fetched
 * from the same API the ingester polls and handed to the same SOURCES[x].parse()
 * — the row is not similar to an ingested one, it is produced by identical code.
 * That is what makes the resulting card behave like every other card: nothing
 * downstream can tell the difference, because there is no difference.
 *
 * Anything else — a company's own careers page, an ATS with no puller here, a
 * link a friend sent — has no API to ask, so the page is read and extracted.
 * Those rows are marked source 'manual' and carry the same provenance fields
 * everything else does, so a salary read off a page is comp_source
 * 'description' exactly as a salary read out of a Greenhouse description is.
 */

const MODEL = "claude-opus-5";

export interface IdentifiedPosting {
  source: BoardSource;
  boardSlug: string;
  postingId: string;
}

/**
 * The posting URL shapes the three boards actually publish.
 *
 * Greenhouse has two live hostnames — job-boards.greenhouse.io is current and
 * boards.greenhouse.io is the older one still all over the internet — and both
 * resolve against the same API, so both are accepted.
 */
const URL_PATTERNS: Array<{ source: BoardSource; re: RegExp }> = [
  { source: "greenhouse", re: /^https?:\/\/(?:job-boards|boards)\.greenhouse\.io\/([a-z0-9_-]+)\/jobs\/(\d+)/i },
  { source: "greenhouse", re: /^https?:\/\/boards\.greenhouse\.io\/embed\/job_app\?for=([a-z0-9_-]+)&token=(\d+)/i },
  { source: "ashby", re: /^https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9_.-]+)\/([0-9a-f-]{36})/i },
  { source: "lever", re: /^https?:\/\/jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)\/([0-9a-f-]{36})/i },
];

/**
 * Posting ids a URL might be carrying, most specific first.
 *
 * Most companies do not publish the ATS's own hostname. Greenhouse lets a board
 * set a custom job URL, and the common result is a link like
 * `careers.datadoghq.com/detail/7194969/?gh_jid=7194969` — the board's identity
 * is nowhere in it, but the posting id is, twice.
 *
 * That id is enough on its own, because monadic has already ingested 17,000
 * postings: if the link points at a job the feed carries, matching the id finds
 * the row that already exists, and the answer is not merely identical to an
 * ingested one — it *is* the ingested one, with whatever interactions it
 * already has. Only a genuine miss goes on to fetch anything.
 */
export function postingIdCandidates(url: string): string[] {
  const out: string[] = [];
  const add = (v: string | undefined) => {
    if (v && !out.includes(v)) out.push(v);
  };

  try {
    const parsed = new URL(url.trim());
    // The query parameters each ATS uses when a board is served from a custom
    // domain. gh_jid is Greenhouse's and by far the most common in the wild.
    for (const key of ["gh_jid", "gh_src_jid", "ashby_jid", "lever_jid"]) {
      add(parsed.searchParams.get(key) ?? undefined);
    }
    // A uuid or a run of digits as the last meaningful path segment.
    const segments = parsed.pathname.split("/").filter(Boolean);
    for (const segment of segments.reverse()) {
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment) || /^\d{5,}$/.test(segment)) {
        add(segment);
        break;
      }
    }
  } catch {
    // Not a URL. The caller reports that; there is nothing to extract.
  }

  return out;
}

export function identifyPosting(url: string): IdentifiedPosting | null {
  for (const { source, re } of URL_PATTERNS) {
    const match = re.exec(url.trim());
    if (match) return { source, boardSlug: match[1], postingId: match[2] };
  }
  return null;
}

/**
 * One posting, fetched and parsed by its own board's code.
 *
 * Each parse() expects the board-shaped envelope it would receive from a full
 * pull, so a single posting is wrapped back into one. Ashby has no
 * single-posting endpoint, so its board is fetched and the posting picked out
 * by id — the same request the ingester makes, just read differently.
 */
export async function fetchAtsPosting(
  id: IdentifiedPosting,
): Promise<{ job: NormalizedJob; companyName: string | null } | null> {
  const source = SOURCES[id.source];

  if (id.source === "ashby") {
    const board = await fetchJson(source.boardUrl(id.boardSlug));
    if (board.kind !== "ok" || !source.isRealBoard(board.body)) return null;
    const job = source.parse(board.body).find((j) => j.sourceJobId === id.postingId);
    return job ? { job, companyName: null } : null;
  }

  const single =
    id.source === "greenhouse"
      ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(id.boardSlug)}/jobs/${encodeURIComponent(id.postingId)}`
      : `https://api.lever.co/v0/postings/${encodeURIComponent(id.boardSlug)}/${encodeURIComponent(id.postingId)}`;

  const response = await fetchJson(single);
  if (response.kind !== "ok" || !response.body) return null;

  const body = response.body as Record<string, unknown>;
  const envelope = id.source === "greenhouse" ? { jobs: [body] } : [body];
  if (!source.isRealBoard(envelope)) return null;

  const [job] = source.parse(envelope);
  if (!job) return null;

  // Greenhouse's single-posting response carries the company name; the board
  // listing does not. Worth taking, because it saves guessing one from a slug.
  const companyName =
    typeof body.company_name === "string" && body.company_name.trim()
      ? body.company_name.trim()
      : null;

  return { job, companyName };
}

/**
 * Hosts that are never the hiring company.
 *
 * This list is the difference between Discord's logo and Greenhouse's. A board
 * URL's hostname belongs to the ATS, and deriving a website from it would send
 * the logo resolver to greenhouse.io and put the job board's mark on the card.
 */
const ATS_HOSTS =
  /(^|\.)(greenhouse\.io|ashbyhq\.com|lever\.co|workable\.com|myworkdayjobs\.com|smartrecruiters\.com|breezy\.hr|recruitee\.com|rippling\.com|applytojob\.com|jobvite\.com|icims\.com|teamtailor\.com|bamboohr\.com|linkedin\.com|indeed\.com|glassdoor\.com|wellfound\.com|ycombinator\.com)$/i;

/** An https origin, or null when the value is empty, unparseable, or an ATS. */
export function normaliseWebsite(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (ATS_HOSTS.test(url.hostname)) return null;
    return `https://${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
}

/**
 * The company's site, found by trying the obvious domains and checking.
 *
 * A last resort, and only reached when neither the board nor the description
 * gave one. Guessing a domain unverified is how a card ends up wearing a
 * squatter's favicon, so nothing is accepted on the strength of resolving:
 * measured on one real case, starbridge.com does not answer at all and
 * starbridge.io sits behind a challenge page, while the actual company is at
 * starbridge.ai. Only a page that says the company's name back is taken.
 *
 * The check is deliberately blunt — the name, stripped to letters and digits,
 * appearing in the page's own title or opening markup. A company's landing page
 * says its name; a parked domain or an unrelated business does not.
 */
export async function guessCompanyWebsite(
  name: string,
  userAgent: string,
): Promise<string | null> {
  const collapsed = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (collapsed.length < 3) return null;

  const needle = collapsed;
  const candidates = [
    `${collapsed}.com`,
    `${collapsed}.ai`,
    `${collapsed}.io`,
    `${collapsed}.co`,
    `${collapsed}.dev`,
    `get${collapsed}.com`,
    `try${collapsed}.com`,
  ];

  for (const host of candidates) {
    try {
      const response = await fetch(`https://${host}`, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(8_000),
        redirect: "follow",
      });
      if (!response.ok) continue;

      const head = (await response.text()).slice(0, 6_000).toLowerCase();
      const title = /<title[^>]*>([^<]{0,200})/.exec(head)?.[1] ?? "";
      const flat = (s: string) => s.replace(/[^a-z0-9]/g, "");

      // A challenge page resolves and says nothing; it must not count.
      if (/just a moment|checking your browser|enable javascript to continue/.test(title)) continue;
      if (flat(title).includes(needle) || flat(head.slice(0, 3_000)).includes(needle)) {
        return `https://${host}`;
      }
    } catch {
      // Unreachable, TLS failure, timeout. Try the next one.
    }
  }
  return null;
}

const IDENTITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["companyName", "companyWebsite"],
  properties: {
    companyName: {
      type: "string",
      description:
        "The hiring company as it brands itself, character for character: 'Weights & Biases' not 'Weights and Biases', 'dbt Labs' not 'DBT Labs', '1Password' not 'OnePassword'. Never a slug, never lowercased. Empty string if the text does not say.",
    },
    companyWebsite: {
      type: "string",
      description:
        "The company's own website as an https:// origin with no path. Empty string unless it is stated in the text or unambiguous from the company's name.",
    },
  },
} as const;

const IDENTITY_SYSTEM = `You are given a job description and the board slug it was published under.

Name the hiring company exactly as it writes its own name — capitalisation,
punctuation and spacing included. The slug is a lowercased, hyphenated
identifier and is never the answer on its own: "weights-and-biases" is the slug,
"Weights & Biases" is the name.

Return "" rather than guessing. A wrong name is worse than no name, because it
is what the card will say.`;

/**
 * Who is hiring, for a board that does not say.
 *
 * Greenhouse returns company_name on a single posting; Ashby and Lever return
 * the postings and nothing else. Falling back to the board slug would put
 * "ramp" on a card that should read "Ramp", and "weights-and-biases" on one
 * that should read "Weights & Biases" — so the description, which almost always
 * introduces the company by name, is read instead.
 *
 * Only ever called for a company monadic does not already have. A company that
 * exists keeps the name it was seeded with.
 */
export async function identifyCompany(
  descriptionText: string | null,
  boardSlug: string,
): Promise<{ name: string | null; website: string | null }> {
  if (!descriptionText || descriptionText.length < 80) {
    return { name: null, website: null };
  }

  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: IDENTITY_SYSTEM,
    output_config: { format: { type: "json_schema", schema: IDENTITY_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Board slug: ${boardSlug}\n\nDescription:\n${descriptionText.slice(0, 12_000)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return { name: null, website: null };
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return { name: null, website: null };

  const parsed = JSON.parse(block.text) as { companyName: string; companyWebsite: string };
  return {
    name: parsed.companyName.trim() || null,
    website: normaliseWebsite(parsed.companyWebsite),
  };
}

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "companyName", "companyWebsite", "locationRaw",
    "employmentType", "department", "isJobPosting",
  ],
  properties: {
    isJobPosting: {
      type: "boolean",
      description: "False if this page is not a single job posting — a listing index, a 404, a login wall, an article.",
    },
    title: {
      type: "string",
      description:
        "The role title, character for character as the page writes it. Keep capitalisation, punctuation, ampersands, slashes, commas, parentheses and any level or region suffix. Do not title-case it, expand abbreviations, or drop a trailing qualifier. Empty string if the page is not a posting.",
    },
    companyName: {
      type: "string",
      description:
        "The hiring company as it brands itself, character for character: 'Weights & Biases' not 'Weights and Biases', 'dbt Labs' not 'DBT Labs', '1Password' not 'OnePassword'. Never a slug, never lowercased, never the job board's name. Empty string if not stated.",
    },
    companyWebsite: {
      type: "string",
      description:
        "The hiring company's own website as an https:// origin with no path, e.g. https://discord.com. Only when the page shows it. Never the job board's domain (greenhouse.io, ashbyhq.com, lever.co, workable.com, myworkdayjobs.com). Empty string if unsure.",
    },
    locationRaw: { type: "string", description: "Location exactly as written on the page. Empty string if not stated." },
    employmentType: { type: "string", description: "Full-time, Contract, Internship, etc. Empty string if not stated." },
    department: { type: "string", description: "Team or function. Empty string if not stated." },
  },
} as const;

const EXTRACT_SYSTEM = `You are reading one web page and deciding whether it is a single job posting.

Set isJobPosting false for a search results page, a list of openings, a 404, a
login wall, or an article about a company. Only a page describing one specific
role is a posting.

Every text field is a plain string. Use "" for anything the page does not state
— never invent, never infer from the company's other roles, and never normalise
a location into a form the page did not use.

Reproduce the title and the company name exactly as written: same capitalisation,
same punctuation, same spacing. These are shown back verbatim and sit alongside
the same fields read straight from an ATS API, so a tidied-up version is a wrong
answer rather than a nicer one.

Do not extract compensation or years of experience. Those are derived from the
description text afterwards by the same code that reads them off every other
posting, so that a figure carries the same provenance regardless of where it
came from.`;

/**
 * Read an arbitrary posting page.
 *
 * The page is stripped to text with the same stripHtml the boards use, then the
 * model pulls out the handful of fields that are genuinely on the page.
 * Compensation and years are deliberately NOT asked for: they are derived
 * afterwards by compFromDescription and yearsFromDescription, the same
 * functions that read them off a Greenhouse description, so a salary found on a
 * careers page carries comp_source 'description' and means exactly what it
 * means everywhere else in the app.
 */
export async function parsePostingPage(
  url: string,
): Promise<{
  job: NormalizedJob;
  companyName: string | null;
  companyWebsite: string | null;
} | null> {
  const { userAgent } = ingestEnv();

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  }

  const text = stripHtml(html);
  if (!text || text.length < 200) return null;

  const client = new Anthropic({ apiKey: anthropicApiKey() });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: EXTRACT_SYSTEM,
    output_config: { format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
    // Truncated: a posting's identifying fields are near the top, and the whole
    // text still goes into description_text below regardless of this cap.
    messages: [{ role: "user", content: `${url}\n\n${text.slice(0, 40_000)}` }],
  });

  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;

  const parsed = JSON.parse(block.text) as {
    isJobPosting: boolean;
    title: string;
    companyName: string;
    companyWebsite: string;
    locationRaw: string;
    employmentType: string;
    department: string;
  };
  if (!parsed.isJobPosting || !parsed.title.trim()) return null;

  const clean = (s: string) => (s.trim() ? s.trim() : null);

  return {
    companyName: clean(parsed.companyName),
    companyWebsite: normaliseWebsite(parsed.companyWebsite),
    job: {
      // The URL is the identity. Two pastes of the same link must be the same
      // row, and nothing else on an arbitrary page is stable enough to key on.
      sourceJobId: url.trim(),
      title: parsed.title.trim(),
      url: url.trim(),
      department: clean(parsed.department),
      team: null,
      employmentType: clean(parsed.employmentType),
      locationRaw: clean(parsed.locationRaw),
      // Derived by the same function the boards use, off the same two hints, so
      // "Remote" on a careers page means what it means on a Greenhouse posting.
      remotePolicy: remotePolicyFrom(parsed.locationRaw, text),
      ...compFromDescription(text),
      ...yearsFromDescription(text, parsed.title),
      descriptionHtml: null,
      descriptionText: text,
      // Unknown. first_seen_at carries when it entered the tracker, and
      // claiming a posting date the page never stated would put a wrong
      // "Posted 3 days ago" on the card.
      postedAt: null,
      raw: { manual: true, url: url.trim(), extracted: parsed },
    },
  };
}
