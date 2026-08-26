import { NextResponse, type NextRequest } from "next/server";
import { hrefFor, parseFilters } from "@/lib/filters";

/**
 * Remembers the feed's filters across a visit elsewhere.
 *
 * The URL stays the only place filter state lives — a filtered feed is still
 * shareable, bookmarkable and back-navigable, and every control is still a link
 * or a GET form. This adds one thing: a cookie holding the last search, used
 * only to answer the question "what should a bare /jobs show?". Arriving with
 * filters in the URL always wins; the cookie never overrides what you asked for.
 *
 * It lives in middleware because that is the only place in the request that can
 * both read a cookie and write one. A Server Component may not set cookies
 * during render, so the alternative was writing it from the client after paint
 * and redirecting on the next load — a flash of the wrong feed every time.
 *
 * Clearing has to be explicit and distinguishable from arriving empty-handed,
 * which is what `reset=1` is for: without it, "Clear all" would navigate to a
 * bare /jobs and be handed its own filters straight back.
 */

const COOKIE = "feed";

/**
 * Every key parseFilters reads as a filter. `page` and `panel` are absent on
 * purpose: neither is part of a search.
 *
 * The presence of any one of these is what marks a URL as having stated its
 * filters, which is a different question from whether any are active. Clearing
 * every box in the panel and submitting sends `years=&comp=&yrsunk=0&...` — a
 * deliberate, empty search. Judging that by whether it resolves to any active
 * filter would read it as "arrived with nothing" and hand back the filters that
 * had just been cleared.
 */
const FILTER_KEYS = [
  "q", "years", "comp", "company", "remote", "yrsunk",
  "compunk", "desc", "recency", "city", "intl", "mix", "saved",
] as const;

/** A month. Long enough to survive a break from looking; short enough to lapse. */
const MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Cookies are capped near 4KB by every browser, and one that goes over is
 * dropped silently rather than rejected loudly. The city list is the only field
 * here with no natural bound, so an oversized search simply is not remembered —
 * the feed still works, it just does not persist.
 */
const MAX_LENGTH = 2000;

/** The page's own searchParams shape: repeated keys as arrays, single as scalars. */
function toRawParams(params: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : all[0];
  }
  return out;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  if (url.searchParams.has("reset")) {
    const target = url.clone();
    target.searchParams.delete("reset");
    const response = NextResponse.redirect(target);
    response.cookies.delete(COOKIE);
    return response;
  }

  const filters = parseFilters(toRawParams(url.searchParams));

  // hrefFor is the canonical encoding and already omits every default, so what
  // gets stored is the search itself rather than the query string that happened
  // to produce it. A form submit sends `yrsunk=0&yrsunk=1` to mean "included",
  // which is the default; round-tripping through parseFilters drops it.
  //
  // panelOpen is cleared because whether the panel was open is not part of the
  // search, and page is never serialised from filters — coming back should
  // resume the search, not page seven of it.
  const canonical = hrefFor({ ...filters, panelOpen: false });
  const query = canonical.startsWith("/jobs?") ? canonical.slice("/jobs?".length) : "";

  if (FILTER_KEYS.some((key) => url.searchParams.has(key))) {
    const response = NextResponse.next();
    if (!query) {
      // Stated, and stated as empty. Forgetting is the point of the request.
      response.cookies.delete(COOKIE);
    } else if (query.length <= MAX_LENGTH) {
      response.cookies.set(COOKIE, query, {
        path: "/",
        maxAge: MAX_AGE,
        sameSite: "lax",
        httpOnly: true,
      });
    }
    return response;
  }

  // Nothing in the URL. Restore, if there is anything to restore.
  const saved = request.cookies.get(COOKIE)?.value;
  if (!saved) return NextResponse.next();

  // A hand-typed ?page=N with no filters is asking for that page of the
  // unfiltered feed. Every link the app generates carries its filters already,
  // so this only ever fires for a URL nothing here produced.
  if (url.searchParams.has("page")) return NextResponse.next();

  const target = url.clone();
  for (const [key, value] of new URLSearchParams(saved)) {
    target.searchParams.append(key, value);
  }
  return NextResponse.redirect(target);
}

export const config = { matcher: "/jobs" };
