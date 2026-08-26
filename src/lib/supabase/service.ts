import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv, supabaseSecretKey } from "@/lib/env";
import type { Database } from "./types";

/**
 * The secret-key client. **Bypasses RLS entirely.**
 *
 * Only scripts/ may import this — ingestion writes companies, jobs and
 * ingestion_runs, which are global tables with no write policy, so they are
 * unreachable any other way.
 *
 * Nothing under src/app may import this module. Doing so would route user data
 * around every policy in the schema and leave the RLS story untested, which is
 * the exact failure the design is built to avoid. Enforced by lint rule; see
 * eslint.config.mjs.
 */
export function createServiceClient(): SupabaseClient<Database> {
  const { url } = supabaseEnv();
  return createClient<Database>(url, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
