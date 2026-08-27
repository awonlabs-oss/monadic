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

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "companyName", "locationRaw", "employmentType", "department", "isJobPosting"],
  properties: {
    isJobPosting: {
      type: "boolean",
      description: "False if this page is not a single job posting — a listing index, a 404, a login wall, an article.",
    },
    title: { type: "string", description: "The role title alone. Empty string if the page is not a posting." },
    companyName: { type: "string", description: "The hiring company. Empty string if not stated." },
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
): Promise<{ job: NormalizedJob; companyName: string | null } | null> {
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
    locationRaw: string;
    employmentType: string;
    department: string;
  };
  if (!parsed.isJobPosting || !parsed.title.trim()) return null;

  const clean = (s: string) => (s.trim() ? s.trim() : null);

  return {
    companyName: clean(parsed.companyName),
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
