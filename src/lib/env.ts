/**
 * Validated environment access.
 *
 * Two rules this file exists to enforce:
 *
 *  1. A missing variable fails immediately with a message naming the variable
 *     and where to get it — never as `undefined` surfacing three layers deeper
 *     as an opaque auth error.
 *  2. Variables are validated lazily, per group. The app must not refuse to boot
 *     because ANTHROPIC_API_KEY is blank when nothing on the current path parses
 *     a resume.
 *
 * Next loads .env / .env.local automatically. Standalone scripts run under tsx
 * do not, so this module loads them itself. It never overwrites a variable that
 * is already set, so the real environment always wins over a file.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Minimal dotenv parse. Enough for KEY=value with optional quotes. */
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key in process.env) continue; // already set — do not clobber
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// .env.local wins over .env, matching Next's own precedence.
const root = process.cwd();
loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const WHERE: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "Supabase dashboard -> Project Settings -> API Keys",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    "Supabase dashboard -> Project Settings -> API Keys (publishable, replaces the old anon key)",
  SUPABASE_SECRET_KEY:
    "Supabase dashboard -> Project Settings -> API Keys -> Secret keys. New projects do not ship one; create it.",
  MONADIC_USER_ID: "A lowercase uuid you choose once. Generate with `uuidgen`.",
  MONADIC_USER_EMAIL: "Any address. Local account only; nothing is sent to it.",
  MONADIC_USER_PASSWORD: "Any password. Local account only.",
  ANTHROPIC_API_KEY: "console.anthropic.com -> API keys",
  INGEST_USER_AGENT:
    'Identify yourself, e.g. "monadic/0.1 (personal job search; +mailto:you@example.com)"',
};

function require(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}.\n` +
        `  Where to get it: ${WHERE[name] ?? "see .env.example"}\n` +
        `  Set it in .env.local (preferred) or .env, then re-run.`,
    );
  }
  return value.trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Supabase connection details. Safe to expose to the browser. */
export function supabaseEnv() {
  return {
    url: require("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: require("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

/**
 * The secret key. Bypasses RLS entirely.
 * Only scripts/ may reach this. Nothing under src/app may import it.
 */
export function supabaseSecretKey(): string {
  return require("SUPABASE_SECRET_KEY");
}

/** The single local account. Stands in for auth until there is a login screen. */
export function localUserEnv() {
  const id = require("MONADIC_USER_ID").toLowerCase();
  if (!UUID_RE.test(id)) {
    throw new Error(
      `MONADIC_USER_ID must be a lowercase uuid, got "${id}".\n` +
        `  Generate one with \`uuidgen\` and lowercase it. It becomes the user_id\n` +
        `  on every row you own, so choose it once and leave it alone.`,
    );
  }
  return {
    id,
    email: require("MONADIC_USER_EMAIL"),
    password: require("MONADIC_USER_PASSWORD"),
    firstName: process.env.MONADIC_USER_FIRST_NAME?.trim() || null,
    lastName: process.env.MONADIC_USER_LAST_NAME?.trim() || null,
  };
}

export function anthropicApiKey(): string {
  return require("ANTHROPIC_API_KEY");
}

/** Outbound HTTP manners for the ingestion layer. */
export function ingestEnv() {
  const concurrency = Number(process.env.INGEST_CONCURRENCY ?? "2");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error(
      `INGEST_CONCURRENCY must be an integer between 1 and 8, got "${process.env.INGEST_CONCURRENCY}".\n` +
        `  Keep it low. Twenty boards at roughly a second each finish in ten\n` +
        `  seconds serially, so there is no speed problem worth being rude for.`,
    );
  }
  return { userAgent: require("INGEST_USER_AGENT"), concurrency };
}
