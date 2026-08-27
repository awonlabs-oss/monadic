/**
 * The shared-password gate.
 *
 * monadic has no accounts. The app signs in to Supabase as one fixed user from
 * the environment, which is fine on a laptop and unacceptable on a public URL:
 * whoever loads it *is* that user, and can read the parsed resume and delete
 * the pipeline. Vercel's own protection does not close this on the free plan —
 * Hobby leaves production domains publicly accessible, and Password Protection
 * is an Enterprise feature or a paid Pro add-on.
 *
 * So one password, checked in middleware, in front of everything.
 *
 * Everything here is Web Crypto rather than node:crypto, because middleware
 * runs on the edge runtime where node:crypto does not exist. That constraint is
 * the reason this file exists at all instead of the logic living inline.
 */

const ENCODER = new TextEncoder();

/** Cookie name. Distinct from the feed cookie the same middleware manages. */
export const SESSION_COOKIE = "monadic_session";

/** Thirty days. Long enough not to be a nuisance, short enough to lapse. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, ENCODER.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Comparison that does not leak where two strings first differ.
 *
 * Length is compared first and separately, which does leak length — that is
 * accepted, because the values here are fixed-width hex digests and their
 * length is not a secret. What must not leak is the position of the first
 * mismatching byte, which is what an early `return false` inside the loop would
 * give away.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The cookie value for a valid session: when it was issued, and proof that
 * whoever issued it knew the password.
 *
 * The timestamp is inside the signed material rather than beside it, so it
 * cannot be edited to extend a session — changing it invalidates the digest.
 */
export async function issueSession(password: string): Promise<string> {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${await hmac(password, issuedAt)}`;
}

export async function isValidSession(
  value: string | undefined,
  password: string,
): Promise<boolean> {
  if (!value) return false;
  const [issuedAt, digest] = value.split(".");
  if (!issuedAt || !digest) return false;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE * 1000) return false;

  return timingSafeEqual(digest, await hmac(password, issuedAt));
}

/** Constant-time check of a submitted password against the configured one. */
export async function isCorrectPassword(
  submitted: string,
  password: string,
): Promise<boolean> {
  // Hashed before comparing so the comparison is over fixed-width values and
  // the length of the real password is not exposed by a length check.
  return timingSafeEqual(await hmac(password, "check"), await hmac(submitted, "check"));
}

/**
 * The configured password, or null.
 *
 * Null is not "allow everyone". Callers fail closed on it — a deploy that
 * forgot the variable should be unusable rather than open, because the failure
 * mode of the alternative is publishing someone's resume.
 */
export function appPassword(): string | null {
  const value = process.env.MONADIC_APP_PASSWORD?.trim();
  return value ? value : null;
}
