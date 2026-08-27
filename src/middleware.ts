import { NextResponse, type NextRequest } from "next/server";
import { hrefFor, parseFilters } from "@/lib/filters";
import { SESSION_COOKIE, appPassword, isValidSession } from "@/lib/auth";

/**
 * Two jobs, in this order: let the request in at all, then remember the feed's
 * filters.
 *
 * The gate is first and it is total. monadic has no accounts — the app signs
 * in to Supabase as one fixed user from the environment — so an unprotected
 * public URL hands whoever finds it a parsed resume and a delete button. This
 * is the only place that can refuse a request before any route runs, which is
 * also why it has to cover /api/* and not just pages: the routes that save,
 * apply, change status and delete are all reachable directly.
 *
 * It fails closed. With no MONADIC_APP_PASSWORD set the answer is 503 and an
 * explanation, not open access, because a deploy that forgot the variable
 * should be broken rather than exposed. Development is exempt so a laptop does
 * not need a password to run `npm run dev`.
 *
 * ---
 *
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

/** Paths that must answer before anyone is signed in. */
function isPublic(pathname: string): boolean {
  return pathname === "/login" || pathname === "/api/auth/login";
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // ---------------------------------------------------------------- the gate
  if (!isPublic(url.pathname) && process.env.NODE_ENV !== "development") {
    const password = appPassword();

    if (!password) {
      return new NextResponse(
        "MONADIC_APP_PASSWORD is not set. This deployment is refusing every request rather than serving personal data without a password.",
        { status: 503, headers: { "content-type": "text/plain" } },
      );
    }

    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!(await isValidSession(session, password))) {
      // An API caller gets a status it can act on; a browser gets the form.
      // Answering /api/* with a redirect to an HTML page would surface as a
      // JSON parse error at the fetch site rather than as "you are signed out".
      if (url.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
      }
      const login = url.clone();
      login.pathname = "/login";
      login.search = "";
      // Where to return to, so a bookmarked filtered feed survives signing in.
      if (url.pathname !== "/") {
        login.searchParams.set("next", url.pathname + url.search);
      }
      return NextResponse.redirect(login);
    }
  }

  // ------------------------------------------------------- the feed's filters
  if (url.pathname !== "/jobs") return NextResponse.next();

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

/*
 * Everything except Next's own static output and the favicon.
 *
 * The matcher was "/jobs" when this file only remembered filters. It cannot
 * stay that way now that it is also the gate: a matcher that misses a route
 * does not fail loudly, it silently serves that route to anyone. Excluding
 * only static assets means a page added later is protected by default rather
 * than by remembering to come back here.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
