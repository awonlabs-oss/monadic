import { NextResponse } from "next/server";
import { authUrl, googleConfig } from "@/outreach/gmail";

/** Start the OAuth dance. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!googleConfig()) {
    return NextResponse.redirect(`${url.origin}/profile?gmail=unconfigured`);
  }
  const redirectUri = `${url.origin}/api/google/callback`;
  // Where to come back to, carried through Google and validated on return.
  const state = url.searchParams.get("next") ?? "/profile";
  const target = authUrl(redirectUri, encodeURIComponent(state));
  return NextResponse.redirect(target as string);
}
