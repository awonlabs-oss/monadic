/**
 * Creates the single local account.
 *
 * There is no signup UI — this is what stands in for one. It creates the
 * auth.users row at the exact id MONADIC_USER_ID names, so that id can be
 * pinned in the environment and every row you own carries it.
 *
 * Idempotent: safe to run repeatedly. If the account already exists it is
 * reused, and only the account_profiles row is refreshed.
 *
 *   npm run seed:user
 */

import { createServiceClient } from "@/lib/supabase/service";
import { getServerClient } from "@/lib/supabase/server";
import { localUserEnv } from "@/lib/env";

async function main() {
  const user = localUserEnv();
  const admin = createServiceClient();

  // Does the account already exist at that id?
  const existing = await admin.auth.admin.getUserById(user.id);

  if (existing.data?.user) {
    console.log(`user:    already exists at ${user.id} (${existing.data.user.email})`);

    if (existing.data.user.email !== user.email) {
      console.warn(
        `\n  WARNING: MONADIC_USER_EMAIL is "${user.email}" but the account at this id\n` +
          `  signs in as "${existing.data.user.email}". Sign-in will fail until they match.\n`,
      );
    }
  } else {
    const created = await admin.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true, // no mail is sent anywhere; confirm inline
    });

    if (created.error) {
      throw new Error(
        `Could not create the local user: ${created.error.message}\n` +
          `  If the email is already taken by a different id, either change\n` +
          `  MONADIC_USER_EMAIL or delete that account in the dashboard.`,
      );
    }

    if (created.data.user?.id !== user.id) {
      throw new Error(
        `Supabase created the user at ${created.data.user?.id}, not the requested ${user.id}.\n` +
          `  Set MONADIC_USER_ID to the created id, or delete the account and retry.`,
      );
    }

    console.log(`user:    created ${user.id} (${user.email})`);
  }

  // account_profiles is written explicitly rather than by an on-signup trigger.
  // That pattern needs a SECURITY DEFINER function reachable from the auth
  // schema, and this schema deliberately has none.
  //
  // Written as the user, through the same client the app uses, rather than with
  // the service key. account_profiles is user data, and service_role's reach is
  // meant to stay limited to the three global tables ingestion writes. It also
  // means this script proves the sign-in path works, not just the admin API.
  const app = await getServerClient();

  const { error: profileError } = await app
    .from("account_profiles")
    .upsert(
      {
        user_id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
      },
      { onConflict: "user_id" },
    );

  if (profileError) {
    throw new Error(`Could not write account_profiles: ${profileError.message}`);
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  console.log(`profile: account_profiles up to date${name ? ` (${name})` : " (no name set)"}`);
  console.log(`\nNext: npm run check:rls`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
