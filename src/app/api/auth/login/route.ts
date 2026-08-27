import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  appPassword,
  isCorrectPassword,
  issueSession,
} from "@/lib/auth";

/**
 * Exchange the password for a session cookie.
 *
 * A route handler rather than a server action because middleware has to let it
 * through unauthenticated, and a named path is something the gate can name. An
 * action posts to whatever route rendered the form, which would mean exempting
 * the page instead — and the page is the one thing that must stay reachable
 * either way, so the exemption would be doing two jobs at once.
 *
 * The redirect target is validated rather than trusted. `next` arrives in a
 * query string, so an unchecked value makes this an open redirect: sign in
 * here, get sent somewhere else entirely. Only same-origin paths are allowed.
 */

export const dynamic = "force-dynamic";

function safeNext(value: FormDataEntryValue | null): string {
  const raw = typeof value === "string" ? value : "";
  // A single leading slash, and never "//" — that is protocol-relative and
  // leaves the site.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function POST(request: Request) {
  const password = appPassword();
  const form = await request.formData();
  const next = safeNext(form.get("next"));
  const submitted = String(form.get("password") ?? "");

  const origin = new URL(request.url).origin;

  if (!password) {
    return NextResponse.redirect(`${origin}/login?error=unconfigured`, { status: 303 });
  }

  if (!submitted || !(await isCorrectPassword(submitted, password))) {
    const back = new URL(`${origin}/login`);
    back.searchParams.set("error", "wrong");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, { status: 303 });
  }

  // 303, so the browser follows with GET. A 307 would replay the POST at the
  // destination and the feed would receive a form body it has no use for.
  const response = NextResponse.redirect(`${origin}${next}`, { status: 303 });
  response.cookies.set(SESSION_COOKIE, await issueSession(password), {
    path: "/",
    maxAge: SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    // Vercel is HTTPS; a laptop over plain http is not, and a Secure cookie
    // there would be set and then never sent back.
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
