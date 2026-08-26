import type { AtsSource } from "./types";

/**
 * The seed list. Adding a company is one line here plus `npm run resolve`.
 *
 * `slug` is monadic's internal identifier and must be stable — it is the
 * natural key on the companies table. `atsSlug`/`atsSource` are optional hints:
 * supply them when you already know the board, and the resolver will verify
 * rather than search. Leave them out and the resolver probes.
 *
 * No discovery from directories, accelerators or aggregators. This list is
 * hand-written on purpose.
 */

export interface CompanySeed {
  name: string;
  slug: string;
  websiteUrl?: string;
  careersUrl?: string;
  /** Skip probing when the board is already known. Still verified before use. */
  atsSource?: AtsSource;
  atsSlug?: string;
}

export const COMPANIES: CompanySeed[] = [
  { name: "Anthropic", slug: "anthropic", websiteUrl: "https://anthropic.com" },
  { name: "Ramp", slug: "ramp", websiteUrl: "https://ramp.com" },
  { name: "Linear", slug: "linear", websiteUrl: "https://linear.app" },
  { name: "Vercel", slug: "vercel", websiteUrl: "https://vercel.com" },
  { name: "Retool", slug: "retool", websiteUrl: "https://retool.com" },
  { name: "Notion", slug: "notion", websiteUrl: "https://notion.so" },
  { name: "Figma", slug: "figma", websiteUrl: "https://figma.com" },
  { name: "Mercury", slug: "mercury", websiteUrl: "https://mercury.com" },
  { name: "Rippling", slug: "rippling", websiteUrl: "https://rippling.com" },
  { name: "Plaid", slug: "plaid", websiteUrl: "https://plaid.com" },
  { name: "Brex", slug: "brex", websiteUrl: "https://brex.com" },
  { name: "Airtable", slug: "airtable", websiteUrl: "https://airtable.com" },
  { name: "Benchling", slug: "benchling", websiteUrl: "https://benchling.com" },
  { name: "Sourcegraph", slug: "sourcegraph", websiteUrl: "https://sourcegraph.com" },
  { name: "Replit", slug: "replit", websiteUrl: "https://replit.com" },
  { name: "Supabase", slug: "supabase", websiteUrl: "https://supabase.com" },
  { name: "Perplexity", slug: "perplexity", websiteUrl: "https://perplexity.ai" },
  { name: "Scale AI", slug: "scale-ai", websiteUrl: "https://scale.com" },
  { name: "Cursor", slug: "cursor", websiteUrl: "https://cursor.com", atsSlug: "anysphere" },
  { name: "Sierra", slug: "sierra", websiteUrl: "https://sierra.ai" },
];

/**
 * Slug candidates to probe, most likely first.
 *
 * ATS slugs are usually the company name with punctuation removed, but the
 * variants differ enough (hyphenated vs collapsed, legal entity vs brand) that
 * probing a small ordered set beats guessing one.
 */
export function slugCandidates(seed: CompanySeed): string[] {
  const base = seed.name.toLowerCase().trim();
  const collapsed = base.replace(/[^a-z0-9]/g, "");
  const hyphenated = base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const firstWord = collapsed.replace(/(ai|hq|labs|inc)$/, "");

  const candidates = [seed.atsSlug, seed.slug, collapsed, hyphenated, firstWord];
  return [...new Set(candidates.filter((s): s is string => !!s && s.length > 1))];
}
