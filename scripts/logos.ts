/**
 * Resolves each company's logo from that company's own website.
 *
 *   npm run logos            fill in anything missing
 *   npm run logos -- --force redo every company
 *
 * The resolver itself lives in src/ingest/logo.ts, because ingest also calls it
 * — a company seeded into the list gets its logo on the next ingest without
 * anyone remembering to run this. What this script adds is the bulk view and
 * --force, which is the only way to redo a company that already resolved.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { ingestEnv } from "@/lib/env";
import { syncCompanyLogo, FLOOR_PX, MIN_PX } from "@/ingest/logo";

const force = process.argv.includes("--force");

async function main() {
  const db = createServiceClient();
  const { userAgent } = ingestEnv();

  let query = db
    .from("companies")
    .select("id, name, slug, website_url, logo_url")
    .not("website_url", "is", null)
    .order("name");
  if (!force) query = query.is("logo_url", null);

  const { data: companies, error } = await query;
  if (error) throw new Error(error.message);

  if (!companies || companies.length === 0) {
    console.log("every company already has a logo. Use --force to redo them.");
    return;
  }

  console.log(`resolving logos for ${companies.length} companies\n`);
  let found = 0;
  let tiny = 0;

  for (const company of companies) {
    const result = await syncCompanyLogo(
      db,
      { id: company.id, slug: company.slug, website_url: company.website_url as string },
      userAgent,
    );

    if (result.outcome === "too_small") {
      console.log(
        `  ${String(result.width) + "px"} too small  ${company.name.padEnd(18)} monogram is crisper`,
      );
    } else if (result.outcome === "found") {
      found += 1;
      const width = result.width as number;
      if (width < MIN_PX) tiny += 1;
      const size = width === Number.POSITIVE_INFINITY ? "vector" : `${width}px`;
      const flag = width < MIN_PX ? " (under 64px — will look soft)" : "";
      console.log(
        `  ${size.padEnd(7)} ${company.name.padEnd(18)} ${(result.href ?? "").slice(0, 62)}${flag}`,
      );
    } else {
      // Not an error. The card falls back to a monogram, which is a designed
      // state rather than a hole.
      console.log(`  none    ${company.name.padEnd(14)} no icon found — monogram will be used`);
    }
  }

  console.log(
    `\n${found}/${companies.length} resolved, ${tiny} of them under ${MIN_PX}px` +
      ` (anything under ${FLOOR_PX}px is stored as null on purpose)`,
  );
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
