import { getServerClient } from "@/lib/supabase/server";

/**
 * Gmail: drafts, and sending behind a review step.
 *
 * A correction is recorded here because it was wrong in the code for a while.
 * This file previously claimed that gmail.compose "cannot send" and that
 * sending was therefore impossible. That is not what the scope does —
 * gmail.compose is documented as "Manage drafts and send emails", and it has
 * permitted sending the entire time. The code only created drafts, which is a
 * different statement from the one the comments made.
 *
 * The scope is unchanged, so no reconnect is needed. What changed is that
 * sending is now implemented, and the guarantee moved from the OAuth grant to
 * the interface: nothing is sent without an explicit review of the exact
 * message, addressed to a named recipient, followed by a deliberate second
 * action. A wrong recipient has no undo, so the review is not a formality and
 * is not skippable.
 *
 * Tokens live in public.google_accounts under RLS, one row per user. The access
 * token is refreshed lazily at the point of use rather than on a schedule,
 * because there is no schedule here to hang it on and a refresh that only
 * happens when something is actually being sent cannot drift.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DRAFT_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/**
 * gmail.compose covers both drafting and sending, so gmail.send is not
 * requested on top of it — it would widen nothing and ask for more.
 */
export const GMAIL_SCOPE = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function authUrl(redirectUri: string, state: string): string | null {
  const config = googleConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    // offline plus consent, because without both Google returns a refresh
    // token on the first grant only. A second connect would then silently
    // produce a row with no way to refresh, which surfaces days later as an
    // expired token and no explanation.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ email: string; tokens: TokenResponse }> {
  const config = googleConfig();
  if (!config) throw new Error("Google OAuth is not configured on this deployment.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google refused the code exchange: ${await response.text()}`);
  }
  const tokens = (await response.json()) as TokenResponse;
  if (!tokens.refresh_token) {
    throw new Error(
      "Google returned no refresh token. Revoke monadic's access in your Google account and connect again.",
    );
  }

  const who = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const email = who.ok ? ((await who.json()) as { email?: string }).email ?? "" : "";

  return { email, tokens };
}

export async function saveTokens(email: string, tokens: TokenResponse): Promise<void> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");

  const row = {
    user_id: user.user.id,
    email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token as string,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scope: tokens.scope ?? "",
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("google_accounts").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`Could not store the Google grant: ${error.message}`);
}

export interface GoogleAccount {
  email: string;
  scope: string;
  connectedAt: string;
}

export async function connectedAccount(): Promise<GoogleAccount | null> {
  const db = await getServerClient();
  const { data } = await db
    .from("google_accounts")
    .select("email, scope, created_at")
    .maybeSingle();
  return data ? { email: data.email, scope: data.scope, connectedAt: data.created_at } : null;
}

export async function disconnect(): Promise<void> {
  const db = await getServerClient();
  const { error } = await db.from("google_accounts").delete().neq("id", "");
  if (error) throw new Error(`Could not disconnect: ${error.message}`);
}

/** A usable access token, refreshed if the stored one has lapsed. */
async function accessToken(): Promise<string> {
  const db = await getServerClient();
  const { data } = await db
    .from("google_accounts")
    .select("id, access_token, refresh_token, expires_at")
    .maybeSingle();
  if (!data) throw new Error("Gmail is not connected.");

  // Sixty seconds of margin, so a token that expires mid-request is refreshed
  // before it is used rather than after it fails.
  if (new Date(data.expires_at).getTime() - 60_000 > Date.now()) return data.access_token;

  const config = googleConfig();
  if (!config) throw new Error("Google OAuth is not configured on this deployment.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(
      "Google would not refresh the token. Disconnect and connect Gmail again.",
    );
  }
  const refreshed = (await response.json()) as TokenResponse;
  await db
    .from("google_accounts")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  return refreshed.access_token;
}

/**
 * RFC 2822 message, base64url encoded, which is what the Gmail API wants.
 *
 * Subjects are encoded per RFC 2047 whenever they carry anything outside
 * ASCII. A company name with an accent in it is not exotic, and an unencoded
 * header arrives as mojibake in the one place the recipient looks first.
 */
function toRawMessage(to: string, subject: string, body: string): string {
  const needsEncoding = /[^\x20-\x7E]/.test(subject);
  const encodedSubject = needsEncoding
    ? `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`
    : subject;

  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Creates a draft in the connected mailbox. Returns its Gmail id. */
export async function createDraft(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ draftId: string; messageId: string }> {
  const token = await accessToken();

  const response = await fetch(DRAFT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { raw: toRawMessage(args.to, args.subject, args.body) },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gmail refused the draft: ${await response.text()}`);
  }
  const created = (await response.json()) as { id: string; message?: { id: string } };
  return { draftId: created.id, messageId: created.message?.id ?? "" };
}


/**
 * Send a message.
 *
 * Reached only from the review step. This function deliberately takes the
 * final text rather than a draft id: what is reviewed and what is sent are then
 * the same bytes, with no window in between where an edit could land after the
 * confirmation and before the send.
 */
export async function sendMessage(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId: string; threadId: string }> {
  const token = await accessToken();

  const response = await fetch(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: toRawMessage(args.to, args.subject, args.body) }),
  });
  if (!response.ok) {
    throw new Error(`Gmail refused to send: ${await response.text()}`);
  }
  const sent = (await response.json()) as { id: string; threadId: string };
  return { messageId: sent.id, threadId: sent.threadId };
}
