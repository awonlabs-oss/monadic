import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exchangeCode, saveTokens } from "@/outreach/gmail";

/**
 * Google's return leg.
 *
 * `state` is where to go afterwards and is validated the same way the login
 * redirect is: same-origin paths only. It arrives having been round-tripped
 * through a third party, so treating it as trusted would make this an open
 * redirect wearing an OAuth callback's clothes.
 */
export const dynamic = "force-dynamic";

function safeNext(raw: string | null): string {
  const value = raw ? decodeURIComponent(raw) : "/profile";
  if (!value.startsWith("/") || value.startsWith("//")) return "/profile";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${url.origin}${next}?gmail=denied`);
  }

  try {
    const { email, tokens } = await exchangeCode(code, `${url.origin}/api/google/callback`);
    await saveTokens(email, tokens);
  } catch {
    // The message can carry Google's raw response, which is not something to
    // put in a query string. The profile page explains the failure generally.
    return NextResponse.redirect(`${url.origin}${next}?gmail=failed`);
  }

  revalidatePath("/profile");
  return NextResponse.redirect(`${url.origin}${next}?gmail=connected`);
}
