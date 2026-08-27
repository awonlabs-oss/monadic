import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { disconnect } from "@/outreach/gmail";

/**
 * Forget the grant.
 *
 * This removes monadic's copy. It does not revoke the grant at Google — that
 * is done from the Google account page, and saying so is more honest than a
 * button that implies more than it does.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await disconnect();
  revalidatePath("/profile");
  return NextResponse.redirect(`${new URL(request.url).origin}/profile?gmail=disconnected`, {
    status: 303,
  });
}
