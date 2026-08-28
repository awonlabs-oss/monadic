/**
 * Maps each seeded company to its ATS and board slug, once and permanently.
 *
 *   npm run resolve                 resolve up to --limit unresolved companies
 *   npm run resolve -- --limit 500  a bigger slice
 *   npm run resolve -- --limit 0    no cap; resolve everything pending
 *   npm run resolve -- --force acme re-resolve one company by slug
 *
 * A company whose ats_resolved_at is set is skipped, including one that failed.
 * That is the point: without caching failures, every run would re-probe every
 * broken company forever. --force clears the stamp for a single company.
 *
 * Two things here exist because the seed list went from a few hundred
 * hand-written companies to a few thousand once the YC directory was added.
 *
 * The cap. Resolving one company costs up to a dozen requests, and the nightly
 * workflow has a wall clock it must fit inside. An uncapped first run against
 * 1,700 pending companies would not finish, and would be killed part-way — which
 * is survivable only because a killed run leaves the companies it never reached
 * exactly as it found them, unresolved and pending. The cap makes that the plan
 * instead of the accident: each night takes a slice, and the backlog drains over
 * a few nights with no cursor to keep.
 *
 * The concurrency. Companies are resolved in parallel, but every request still
 * goes through http.ts's global gate, so the outbound rate against Greenhouse,
 * Ashby and Lever is exactly what INGEST_CONCURRENCY says it is regardless of
 * how many companies are in flight here. The parallelism removes the dead time
 * between one company's last request and the next company's first, not the
 * politeness.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { COMPANIES, HAND_PICKED } from "@/ingest/companies.config";
import { resolveCompany } from "@/ingest/resolver";

const forceIndex = process.argv.indexOf("--force");
const forceSlug = forceIndex !== -1 ? process.argv[forceIndex + 1] : null;

const limitIndex = process.argv.indexOf("--limit");
const DEFAULT_LIMIT = 250;
const limit =
  limitIndex !== -1 && process.argv[limitIndex + 1] !== undefined
    ? Math.max(0, Number(process.argv[limitIndex + 1]) || 0)
    : DEFAULT_LIMIT;

/** How many companies are resolved at once. The http gate still caps requests. */
const WORKERS = 8;

/** Run `task` over `items` with a fixed number of workers, preserving nothing. */
async function pool<T>(items: T[], workers: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        await task(items[index]);
      }
    }),
  );
}

async function main() {
  const db = createServiceClient();

  // Seed rows for anything new in the config. Existing rows keep their
  // resolution — this never overwrites a resolved board.
  //
  // Batched. One upsert per company was fine for a few hundred; at a few
  // thousand it is a few thousand round trips before any work starts.
  const BATCH = 500;
  for (let i = 0; i < COMPANIES.length; i += BATCH) {
    const rows = COMPANIES.slice(i, i + BATCH).map((seed) => ({
      name: seed.name,
      slug: seed.slug,
      website_url: seed.websiteUrl ?? null,
      careers_url: seed.careersUrl ?? null,
    }));
    const { error } = await db
      .from("companies")
      .upsert(rows, { onConflict: "slug", ignoreDuplicates: true });
    if (error) throw new Error(`seeding batch ${i / BATCH}: ${error.message}`);
  }
  console.log(`${COMPANIES.length.toLocaleString()} companies seeded\n`);

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

  // The true size of the backlog, for the log line. A head count rather than
  // the length of a fetched list, because the fetched list is capped.
  const { count: pendingTotal } = await db
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("ats_resolution_status", "unresolved");

  /*
   * Hand-picked companies go first, then the directory.
   *
   * The database has no column saying which list a row came from, and adding
   * one would be a migration to express something the config already knows, so
   * the split is two queries rather than an ORDER BY. A capped run must not
   * spend its entire budget on directory entries beginning with a digit while a
   * company someone deliberately added waits another night.
   *
   * Both queries carry an explicit limit, and that is load-bearing rather than
   * tidy. PostgREST caps an unbounded select at 1,000 rows, so the first version
   * of this — one unlimited select, ordered and sliced in JavaScript — silently
   * saw only the alphabetically-first thousand of a 1,427-row backlog and could
   * not have reached the rest no matter how many nights it ran.
   */
  const budget = limit > 0 ? limit : 5_000;
  const handPickedSlugs = HAND_PICKED.map((c) => c.slug);

  const { data: pendingHandPicked, error: handPickedError } = await db
    .from("companies")
    .select("id, name, slug")
    .eq("ats_resolution_status", "unresolved")
    .in("slug", handPickedSlugs)
    .order("name")
    .limit(budget);
  if (handPickedError) throw new Error(handPickedError.message);

  const pending = [...(pendingHandPicked ?? [])];

  if (pending.length < budget) {
    const handPicked = new Set(handPickedSlugs);
    // Over-fetch, because the directory rows are mixed in with hand-picked ones
    // that this pass has to drop.
    const { data: rest, error: restError } = await db
      .from("companies")
      .select("id, name, slug")
      .eq("ats_resolution_status", "unresolved")
      .order("name")
      .limit(Math.min(1_000, (budget - pending.length) * 2 + 50));
    if (restError) throw new Error(restError.message);

    for (const company of rest ?? []) {
      if (pending.length >= budget) break;
      if (handPicked.has(company.slug)) continue;
      pending.push(company);
    }
  }

  if (!pending || pending.length === 0) {
    console.log("nothing to resolve. Every company already has a cached result.");
    console.log("Use --force <slug> to retry one.");
    return;
  }

  // A Map, not COMPANIES.find per company: the seed list is thousands long now
  // and the lookup was inside the loop.
  const seedBySlug = new Map(COMPANIES.map((c) => [c.slug, c]));

  console.log(
    `resolving ${pending.length.toLocaleString()} of ${(pendingTotal ?? pending.length).toLocaleString()}` +
      ` pending, ${WORKERS} at a time\n`,
  );

  let resolved = 0;
  let attempted = 0;
  await pool(pending, WORKERS, async (company) => {
    const seed = seedBySlug.get(company.slug);
    if (!seed) return;
    attempted += 1;

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
        `  ok      ${company.name.padEnd(28)} ${result.source}/${result.slug}` +
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

      console.log(`  FAILED  ${company.name.padEnd(28)} ${result.error}`);
    }
  });

  const remaining = Math.max(0, (pendingTotal ?? attempted) - attempted);
  console.log(`\n${resolved}/${attempted} resolved.`);
  if (remaining > 0) {
    console.log(
      `${remaining.toLocaleString()} still pending — the next run takes the next slice.`,
    );
  }
  console.log("Next: npm run ingest");
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
