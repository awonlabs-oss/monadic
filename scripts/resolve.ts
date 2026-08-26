/**
 * Maps each seeded company to its ATS and board slug, once and permanently.
 *
 *   npm run resolve                 resolve anything still unresolved
 *   npm run resolve -- --force acme re-resolve one company by slug
 *
 * A company whose ats_resolved_at is set is skipped, including one that failed.
 * That is the point: without caching failures, every run would re-probe every
 * broken company forever. --force clears the stamp for a single company.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { COMPANIES } from "@/ingest/companies.config";
import { resolveCompany } from "@/ingest/resolver";

const forceIndex = process.argv.indexOf("--force");
const forceSlug = forceIndex !== -1 ? process.argv[forceIndex + 1] : null;

async function main() {
  const db = createServiceClient();

  // Seed rows for anything new in the config. Existing rows keep their
  // resolution — this never overwrites a resolved board.
  for (const seed of COMPANIES) {
    const { error } = await db.from("companies").upsert(
      {
        name: seed.name,
        slug: seed.slug,
        website_url: seed.websiteUrl ?? null,
        careers_url: seed.careersUrl ?? null,
      },
      { onConflict: "slug", ignoreDuplicates: true },
    );
    if (error) throw new Error(`seeding ${seed.slug}: ${error.message}`);
  }

  if (forceSlug) {
    const { error } = await db
      .from("companies")
      .update({
        ats_resolution_status: "unresolved",
        ats_resolved_at: null,
        ats_resolution_error: null,
        ats_resolution_method: null,
      })
      .eq("slug", forceSlug);
    if (error) throw new Error(`--force ${forceSlug}: ${error.message}`);
    console.log(`forced re-resolution of ${forceSlug}\n`);
  }

  const { data: pending, error } = await db
    .from("companies")
    .select("id, name, slug")
    .eq("ats_resolution_status", "unresolved")
    .order("name");
  if (error) throw new Error(error.message);

  if (!pending || pending.length === 0) {
    console.log("nothing to resolve. Every company already has a cached result.");
    console.log("Use --force <slug> to retry one.");
    return;
  }

  console.log(`resolving ${pending.length} companies\n`);

  let resolved = 0;
  for (const company of pending) {
    const seed = COMPANIES.find((c) => c.slug === company.slug);
    if (!seed) continue;

    const result = await resolveCompany(seed);
    const now = new Date().toISOString();

    if (result.outcome === "resolved") {
      resolved += 1;
      const { error: updateError } = await db
        .from("companies")
        .update({
          ats_source: result.source,
          ats_slug: result.slug,
          ats_board_url: result.boardUrl,
          ats_resolution_status: "resolved",
          ats_resolution_method: result.method,
          ats_resolved_at: now,
          ats_resolution_error: null,
        })
        .eq("id", company.id);
      if (updateError) throw new Error(`${company.slug}: ${updateError.message}`);

      console.log(
        `  ok      ${company.name.padEnd(14)} ${result.source}/${result.slug}` +
          ` (${result.jobCount} jobs, via ${result.method})`,
      );
    } else {
      const { error: updateError } = await db
        .from("companies")
        .update({
          ats_resolution_status: "failed",
          ats_resolved_at: now,
          ats_resolution_error: result.error,
          raw: { attempts: result.attempts } as never,
        })
        .eq("id", company.id);
      if (updateError) throw new Error(`${company.slug}: ${updateError.message}`);

      console.log(`  FAILED  ${company.name.padEnd(14)} ${result.error}`);
    }
  }

  console.log(`\n${resolved}/${pending.length} resolved. Next: npm run ingest`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
