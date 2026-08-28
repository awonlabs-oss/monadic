/**
 * Builds the YC half of the seed list from Y Combinator's public company
 * directory.
 *
 *   npm run discover:yc            rewrite src/ingest/companies.yc.json
 *   npm run discover:yc -- --all   include active companies not flagged hiring
 *
 * This reverses a decision. companies.config.ts said, in its own words, "no
 * discovery from directories, accelerators or aggregators — that is out of
 * scope, and scraping YC or Crunchbase to build this file would be exactly
 * that." That rule was written to keep the seed list something a person had
 * chosen, and it is also what kept the feed small: a hand-written list caps the
 * corpus at however many companies someone was willing to type. Reach is now
 * the goal, so the rule goes — recorded here rather than quietly deleted.
 *
 * What it is not is scraping. yc-oss.github.io/api is a static JSON mirror of
 * YC's own public directory, published for programmatic use and rebuilt daily.
 * One conditional GET of one file, no HTML parsing, no session, no pagination
 * against someone's product.
 *
 * Work at a Startup — where YC postings themselves live — is deliberately not a
 * source. It answers non-browser requests with 406, which is the server saying
 * no, and reading it anyway would need the headless browser that http.ts names
 * as the thing that makes a source the wrong source. The route to those jobs is
 * this one: the directory names the companies, the resolver finds the boards
 * they already publish, and the boards are read the same way every other board
 * in this project is.
 *
 * The output is a data file rather than TypeScript so that a regeneration shows
 * up in review as a data diff, and so a thousand-odd entries never have to be
 * formatted by hand.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANIES } from "@/ingest/companies.config";
import { ingestEnv } from "@/lib/env";

const SOURCE = "https://yc-oss.github.io/api/companies/hiring.json";
const OUT = join(process.cwd(), "src/ingest/companies.yc.json");

const includeAll = process.argv.includes("--all");

/** The fields this script reads. The upstream row carries about thirty. */
interface YcCompany {
  name: string;
  slug: string;
  website: string | null;
  status: string;
  isHiring: boolean;
  nonprofit: boolean;
  batch: string | null;
  industry: string | null;
  team_size: number | null;
}

export interface YcSeed {
  name: string;
  slug: string;
  websiteUrl?: string;
  /** YC batch, kept only so a regenerated file is readable by a person. */
  batch?: string;
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  return (
    url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .toLowerCase() || null
  );
}

async function main() {
  const { userAgent } = ingestEnv();

  const response = await fetch(SOURCE, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);

  const all = (await response.json()) as YcCompany[];
  console.log(`fetched ${all.length.toLocaleString()} companies from the YC directory`);

  /*
   * Hand-written seeds win every collision.
   *
   * Three ways the same company appears in both lists: the same slug, the same
   * name once punctuation is stripped, or the same domain under a different
   * name. All three are checked, because letting one through would seed a
   * second companies row for a company already being ingested — and the jobs
   * table is keyed on (company, source job id), so the duplicate would ingest
   * every one of its postings a second time under a different company.
   */
  const takenSlugs = new Set(COMPANIES.map((c) => c.slug));
  const takenNames = new Set(COMPANIES.map((c) => normalise(c.name)));
  const takenDomains = new Set(
    COMPANIES.map((c) => domainOf(c.websiteUrl)).filter((d): d is string => Boolean(d)),
  );

  const seeds: YcSeed[] = [];
  const skipped = { inactive: false, nonprofit: 0, noWebsite: 0, duplicate: 0, notHiring: 0 };
  let inactive = 0;

  for (const c of all) {
    // hiring.json is already filtered to companies flagged as hiring, but it
    // still carries acquired and shut-down ones, whose boards are gone.
    if (c.status !== "Active") {
      inactive += 1;
      continue;
    }
    if (!includeAll && !c.isHiring) {
      skipped.notHiring += 1;
      continue;
    }
    // A nonprofit is not what this feed is for, and the filter is one field.
    if (c.nonprofit) {
      skipped.nonprofit += 1;
      continue;
    }
    // No website means no domain slug candidate and no careers page to
    // fingerprint, which leaves the resolver guessing from the name alone.
    if (!c.website) {
      skipped.noWebsite += 1;
      continue;
    }

    const domain = domainOf(c.website);
    if (
      takenSlugs.has(c.slug) ||
      takenNames.has(normalise(c.name)) ||
      (domain && takenDomains.has(domain))
    ) {
      skipped.duplicate += 1;
      continue;
    }

    takenSlugs.add(c.slug);
    takenNames.add(normalise(c.name));
    if (domain) takenDomains.add(domain);

    seeds.push({
      name: c.name,
      slug: c.slug,
      websiteUrl: c.website,
      ...(c.batch ? { batch: c.batch } : {}),
    });
  }

  // Sorted by slug so a regeneration is a readable diff rather than a reshuffle
  // in whatever order the upstream file happened to arrive in.
  seeds.sort((a, b) => a.slug.localeCompare(b.slug));

  writeFileSync(OUT, `${JSON.stringify(seeds, null, 2)}\n`, "utf8");

  console.log(`  skipped ${inactive} not active`);
  if (!includeAll) console.log(`  skipped ${skipped.notHiring} not flagged hiring`);
  console.log(`  skipped ${skipped.nonprofit} nonprofits`);
  console.log(`  skipped ${skipped.noWebsite} without a website`);
  console.log(`  skipped ${skipped.duplicate} already in the hand-written list`);
  console.log(`\nwrote ${seeds.length.toLocaleString()} seeds to ${OUT}`);
  console.log("Next: npm run resolve");
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
