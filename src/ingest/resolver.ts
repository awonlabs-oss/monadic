import { fetchJson } from "./http";
import { SOURCES } from "./sources";
import { slugCandidates, type CompanySeed } from "./companies.config";
import type { AtsSource } from "./types";

/**
 * Maps a company to its ATS and board slug.
 *
 * Probe first, fingerprint second, exactly in that order. Constructing a slug
 * from the company name and asking three JSON endpoints is cheap, precise, and
 * gives an unambiguous answer; fetching and pattern-matching a careers page is
 * none of those, so it only runs when probing has failed outright.
 *
 * The result is cached permanently on the company row. This module never
 * decides whether to run — persist/resolve does, by checking ats_resolved_at.
 * A failure caches too, otherwise every run would retry every broken company
 * forever; clearing ats_resolved_at is the deliberate retry.
 */

export interface ResolutionSuccess {
  outcome: "resolved";
  source: AtsSource;
  slug: string;
  boardUrl: string;
  method: "probe" | "fingerprint";
  jobCount: number;
}

export interface ResolutionFailure {
  outcome: "failed";
  error: string;
  attempts: string[];
}

export type Resolution = ResolutionSuccess | ResolutionFailure;

/** Ordered: cheapest and most-used board first. */
const PROBE_ORDER: AtsSource[] = ["greenhouse", "ashby", "lever"];

async function probe(seed: CompanySeed): Promise<Resolution> {
  const attempts: string[] = [];
  const candidates = slugCandidates(seed);

  // If a source hint was given, try it exclusively first — verifying a known
  // answer should not cost three requests per candidate.
  const order = seed.atsSource
    ? [seed.atsSource, ...PROBE_ORDER.filter((s) => s !== seed.atsSource)]
    : PROBE_ORDER;

  for (const sourceName of order) {
    const source = SOURCES[sourceName];
    for (const slug of candidates) {
      const url = source.boardUrl(slug);
      const result = await fetchJson(url);

      if (result.kind === "ok" && source.isRealBoard(result.body)) {
        const jobs = source.parse(result.body);
        // A real board with zero postings is indistinguishable from a wrong
        // slug that happens to return a valid empty shape, so it is not
        // accepted as proof. Keep probing; fall back to it only if nothing
        // better turns up.
        if (jobs.length > 0) {
          return {
            outcome: "resolved",
            source: sourceName,
            slug,
            boardUrl: url,
            method: "probe",
            jobCount: jobs.length,
          };
        }
        attempts.push(`${sourceName}/${slug}: valid board, 0 jobs`);
        continue;
      }

      attempts.push(
        `${sourceName}/${slug}: ${
          result.kind === "error" ? result.message : `${result.kind}`
        }`,
      );
    }
  }

  return {
    outcome: "failed",
    error: "no board matched any slug candidate",
    attempts,
  };
}

/**
 * Fallback: read the careers page and look for a board URL in the markup.
 *
 * Only runs when probing found nothing. Plain HTML fetch and regex — no
 * headless browser, by design. A careers page that needs one to read is out of
 * scope rather than a problem to solve.
 */
const FINGERPRINTS: Array<{ source: AtsSource; re: RegExp }> = [
  { source: "greenhouse", re: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i },
  { source: "ashby", re: /jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i },
  { source: "lever", re: /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_-]+)/i },
];

async function fingerprint(seed: CompanySeed): Promise<Resolution> {
  const pages = [seed.careersUrl, seed.websiteUrl ? `${seed.websiteUrl.replace(/\/$/, "")}/careers` : null]
    .filter((u): u is string => Boolean(u));

  const attempts: string[] = [];

  for (const page of pages) {
    let html: string;
    try {
      const response = await fetch(page, {
        headers: { "User-Agent": (await import("@/lib/env")).ingestEnv().userAgent },
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
      });
      if (!response.ok) {
        attempts.push(`${page}: HTTP ${response.status}`);
        continue;
      }
      html = await response.text();
    } catch (err) {
      attempts.push(`${page}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    for (const { source: sourceName, re } of FINGERPRINTS) {
      const match = html.match(re);
      if (!match?.[1]) continue;

      // Confirm rather than trust — a stale link in a footer is common.
      const source = SOURCES[sourceName];
      const url = source.boardUrl(match[1]);
      const result = await fetchJson(url);
      if (result.kind === "ok" && source.isRealBoard(result.body)) {
        return {
          outcome: "resolved",
          source: sourceName,
          slug: match[1],
          boardUrl: url,
          method: "fingerprint",
          jobCount: source.parse(result.body).length,
        };
      }
      attempts.push(`${page}: found ${sourceName}/${match[1]} but the board did not verify`);
    }
    attempts.push(`${page}: no ATS link found`);
  }

  return { outcome: "failed", error: "probe and fingerprint both failed", attempts };
}

export async function resolveCompany(seed: CompanySeed): Promise<Resolution> {
  const probed = await probe(seed);
  if (probed.outcome === "resolved") return probed;

  const fingerprinted = await fingerprint(seed);
  if (fingerprinted.outcome === "resolved") return fingerprinted;

  return {
    outcome: "failed",
    error: fingerprinted.error,
    attempts: [...probed.attempts, ...fingerprinted.attempts],
  };
}
