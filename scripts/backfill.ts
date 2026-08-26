/**
 * Re-derives extracted fields from the raw payloads already in the database.
 *
 *   npm run backfill              apply
 *   npm run backfill -- --dry     report what would change, write nothing
 *
 * This is the payoff of storing the untouched ATS response on every row. When
 * an extractor improves, nothing needs re-fetching: no requests leave the
 * machine, no board is bothered, and postings that have since closed are
 * corrected too.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { SOURCES } from "@/ingest/sources";
import type { AtsSource } from "@/ingest/types";
import { parseLocation } from "@/ingest/location";

const dryRun = process.argv.includes("--dry");
const CHUNK = 200;

async function main() {
  const db = createServiceClient();

  const { count } = await db.from("jobs").select("id", { count: "exact", head: true });
  console.log(`${count ?? 0} jobs to re-derive${dryRun ? " (dry run)" : ""}\n`);

  let scanned = 0;
  let yearsGained = 0;
  let yearsLost = 0;
  let yearsChanged = 0;
  let compGained = 0;
  let usEligible = 0;
  let updated = 0;

  for (let offset = 0; ; offset += CHUNK) {
    const { data: rows, error } = await db
      .from("jobs")
      .select("id, source, source_job_id, raw, years_min, years_max, years_source, comp_min, comp_source, location_raw, us_eligible, location_cities")
      .order("id")
      .range(offset, offset + CHUNK - 1);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;

    type Derived = {
      source: AtsSource;
      sourceJobId: string;
      years_min: number | null;
      years_max: number | null;
      years_source: string;
      comp_min: number | null;
      comp_max: number | null;
      comp_currency: string | null;
      comp_period: string | null;
      comp_source: string;
      comp_note: string | null;
      location_cities: string[];
      location_countries: string[];
      us_eligible: boolean;
    };
    const updates: Derived[] = [];

    for (const row of rows) {
      scanned += 1;
      const source = SOURCES[row.source as AtsSource];

      // Re-run the source's own parser over the stored payload. Each parse()
      // expects a board-shaped envelope, so the single row is wrapped back into
      // one — that keeps this script from duplicating any parsing logic.
      const envelope =
        row.source === "lever" ? [row.raw] : { jobs: [row.raw] };
      const [parsed] = source.parse(envelope);
      if (!parsed) continue;

      const hadYears = row.years_source !== "none";
      const hasYears = parsed.yearsSource !== "none";

      if (!hadYears && hasYears) yearsGained += 1;
      else if (hadYears && !hasYears) yearsLost += 1;
      else if (hadYears && hasYears && row.years_min !== parsed.yearsMin) yearsChanged += 1;

      if (row.comp_source === "none" && parsed.compSource !== "none") compGained += 1;

      const loc = parseLocation(row.location_raw);
      if (loc.usEligible) usEligible += 1;

      // The city array has to be compared too. An earlier version only checked
      // us_eligible, so a fix that corrected which cities were extracted
      // rewrote nothing and reported "0 rows written" while looking successful.
      const citiesChanged =
        JSON.stringify(row.location_cities ?? []) !== JSON.stringify(loc.cities);

      const changed =
        citiesChanged ||
        row.us_eligible !== loc.usEligible ||
        row.years_source !== parsed.yearsSource ||
        row.years_min !== parsed.yearsMin ||
        row.years_max !== parsed.yearsMax ||
        row.comp_source !== parsed.compSource;

      if (!changed) continue;

      updates.push({
        source: row.source as AtsSource,
        sourceJobId: row.source_job_id,
        years_min: parsed.yearsMin,
        years_max: parsed.yearsMax,
        years_source: parsed.yearsSource,
        comp_min: parsed.compMin,
        comp_max: parsed.compMax,
        comp_currency: parsed.compCurrency,
        comp_period: parsed.compPeriod,
        comp_source: parsed.compSource,
        comp_note: parsed.compNote,
        location_cities: loc.cities,
        location_countries: loc.countries,
        us_eligible: loc.usEligible,
      });
    }

    if (updates.length > 0 && !dryRun) {
      // Only the derived columns are written. first_seen_at in particular must
      // not be touched: it is what the feed sorts on.
      for (const { source, sourceJobId, ...fields } of updates) {
        const { error: updateError } = await db
          .from("jobs")
          .update(fields)
          .eq("source", source)
          .eq("source_job_id", sourceJobId);
        if (updateError) throw new Error(`update failed: ${updateError.message}`);
      }
    }
    updated += updates.length;

    if (rows.length < CHUNK) break;
  }

  console.log(`  scanned         ${scanned}`);
  console.log(`  years gained    ${yearsGained}`);
  console.log(`  years changed   ${yearsChanged}`);
  console.log(`  years lost      ${yearsLost}`);
  console.log(`  comp gained     ${compGained}`);
  console.log(`  US-eligible     ${usEligible}`);
  console.log(`  rows ${dryRun ? "that would change" : "written"}   ${updated}`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
