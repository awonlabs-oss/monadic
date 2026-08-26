import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv, localUserEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * The client every app route uses.
 *
 * It holds the **publishable** key and a real signed-in session, so RLS applies
 * to every query exactly as it will once a login screen exists. That is the
 * point: a broken policy fails here, in development, rather than on the day
 * auth is switched on. The tempting shortcut — running the app on the secret
 * key — would leave all nineteen tables' policies unexecuted and decorative.
 *
 * ---
 *
 * This module is the single-user shim, and the only place that knows there is
 * no login. It signs in as the seeded account with credentials from the
 * environment and caches the session for the life of the process.
 *
 * When auth arrives, this file is what changes: swap the password sign-in for a
 * cookie-backed session via @supabase/ssr. Callers keep calling
 * getServerClient() and none of them change — which is what "adding auth later
 * is a UI change, never a migration" has to mean in practice.
 */

let cached: Promise<SupabaseClient<Database>> | null = null;

async function signIn(): Promise<SupabaseClient<Database>> {
  const { url, publishableKey } = supabaseEnv();
  const user = localUserEnv();

  const client = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(
      `Could not sign in as the local user (${user.email}): ${error.message}\n` +
        `  If the account does not exist yet, run: npm run seed:user\n` +
        `  If it does, check MONADIC_USER_EMAIL and MONADIC_USER_PASSWORD.`,
    );
  }

  // A mismatch here means the app would silently read and write another user's
  // rows. Every policy would still pass, and every row would be wrong.
  if (data.user?.id !== user.id) {
    throw new Error(
      `MONADIC_USER_ID does not match the account that ${user.email} signs in as.\n` +
        `  env says:      ${user.id}\n` +
        `  signed in as:  ${data.user?.id}\n` +
        `  Fix MONADIC_USER_ID, or delete the account and re-run npm run seed:user.`,
    );
  }

  return client;
}

export function getServerClient(): Promise<SupabaseClient<Database>> {
  if (!cached) {
    cached = signIn().catch((err) => {
      cached = null; // never cache a failed sign-in — the next request retries
      throw err;
    });
  }
  return cached;
}
