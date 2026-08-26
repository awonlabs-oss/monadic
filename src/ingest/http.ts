import { ingestEnv } from "@/lib/env";

/**
 * Every outbound request in this project goes through here.
 *
 * No source module calls fetch directly, so "respect the sources" is one file
 * to audit rather than three conventions to remember. That means: a real
 * User-Agent naming a contact, a global concurrency cap, exponential backoff
 * that honours Retry-After on 429 and 5xx, and conditional requests where the
 * board supports them.
 *
 * Explicitly not here, and not wanted: proxies, headless browsers, CAPTCHA
 * handling. A source needing any of those is the wrong source.
 */

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1_000;
const TIMEOUT_MS = 30_000;

export type FetchOutcome<T> =
  | { kind: "ok"; status: number; body: T; etag: string | null; lastModified: string | null }
  | { kind: "not_modified"; status: 304 }
  | { kind: "error"; status: number | null; message: string; attempts: number };

/** Global cap on in-flight requests. Small on purpose. */
class Gate {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

let gate: Gate | null = null;
function getGate() {
  if (!gate) gate = new Gate(ingestEnv().concurrency);
  return gate;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Honour Retry-After when the server sends it — it is the server telling us
 * exactly how long to wait, and guessing instead is the rude option.
 */
function backoffFor(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), 60_000);
  }
  return BASE_BACKOFF_MS * 2 ** attempt;
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: { etag?: string | null; lastModified?: string | null } = {},
): Promise<FetchOutcome<T>> {
  const { userAgent } = ingestEnv();

  return getGate().run(async () => {
    let lastMessage = "unknown error";
    let lastStatus: number | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await sleep(backoffFor(attempt - 1, null));

      const headers: Record<string, string> = {
        "User-Agent": userAgent,
        Accept: "application/json",
      };
      // Conditional support is uneven across these three, so both headers are
      // sent opportunistically and a 304 is simply believed when it arrives.
      if (opts.etag) headers["If-None-Match"] = opts.etag;
      if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

      try {
        const response = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: "follow",
        });

        lastStatus = response.status;

        if (response.status === 304) return { kind: "not_modified", status: 304 };

        if (response.status === 429 || response.status >= 500) {
          lastMessage = `HTTP ${response.status}`;
          const wait = backoffFor(attempt, response.headers.get("retry-after"));
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(wait);
            continue;
          }
          break;
        }

        if (!response.ok) {
          // 4xx other than 429 is a fact about the URL, not a transient fault.
          // Retrying a 404 board slug just wastes someone else's capacity.
          return {
            kind: "error",
            status: response.status,
            message: `HTTP ${response.status}`,
            attempts: attempt + 1,
          };
        }

        const text = await response.text();
        try {
          return {
            kind: "ok",
            status: response.status,
            body: JSON.parse(text) as T,
            etag: response.headers.get("etag"),
            lastModified: response.headers.get("last-modified"),
          };
        } catch {
          // A 200 carrying HTML is the classic "your slug is wrong and the ATS
          // served a marketing page" case. Not retryable.
          return {
            kind: "error",
            status: response.status,
            message: `200 but body is not JSON (${text.slice(0, 80).replace(/\s+/g, " ")}…)`,
            attempts: attempt + 1,
          };
        }
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : String(err);
      }
    }

    return { kind: "error", status: lastStatus, message: lastMessage, attempts: MAX_ATTEMPTS };
  });
}
