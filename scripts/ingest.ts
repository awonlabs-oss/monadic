/**
 * Pulls every resolved company's board and writes the postings.
 *
 *   npm run ingest              every resolved company
 *   npm run ingest -- acme      one company, by monadic slug
 *
 * Manual only. There is no scheduler and none is wanted yet.
 */

import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { SOURCES } from "@/ingest/sources";
import { fetchJson } from "@/ingest/http";
import { persistPull, type PullOutcome } from "@/ingest/persist";
import { ingestEnv } from "@/lib/env";

const onlySlug = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;

async function main() {
  const db = createServiceClient();
  const batchId = randomUUID();
  const { concurrency } = ingestEnv();

  let query = db
    .from("companies")
    .select("id, name, slug, ats_source, ats_slug, ats_etag, ats_last_modified")
    .eq("ats_resolution_status", "resolved")
    .order("name");
  if (onlySlug) query = query.eq("slug", onlySlug);

  const { data: companies, error } = await query;
  if (error) throw new Error(error.message);

  if (!companies || companies.length === 0) {
    console.log("no resolved companies. Run: npm run resolve");
    return;
  }

  console.log(
    `batch ${batchId.slice(0, 8)} — ${companies.length} companies, concurrency ${concurrency}\n`,
  );

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalClosed = 0;
  let failures = 0;

  for (const company of companies) {
    if (!company.ats_source || !company.ats_slug) continue;

    const source = SOURCES[company.ats_source];
    const startedAt = new Date();
    const url = source.boardUrl(company.ats_slug);

    const response = await fetchJson(url, {
      etag: company.ats_etag,
      lastModified: company.ats_last_modified,
    });

    let outcome: PullOutcome;

    if (response.kind === "ok") {
      if (!source.isRealBoard(response.body)) {
        // 200 with an unexpected shape means the ATS changed its response, not
        // that the company stopped hiring. Treated as a failure so that nothing
        // gets closed on the strength of it.
        outcome = {
          status: "failure",
          httpStatus: response.status,
          jobs: [],
          errorMessage: "200 but the payload is not a recognisable board",
          errorDetail: null,
          etag: null,
          lastModified: null,
        };
      } else {
        outcome = {
          status: "success",
          httpStatus: response.status,
          jobs: source.parse(response.body),
          errorMessage: null,
          errorDetail: null,
          etag: response.etag,
          lastModified: response.lastModified,
        };
      }
    } else if (response.kind === "not_modified") {
      // Nothing changed, so nothing can have closed. Recorded, not acted on.
      outcome = {
        status: "not_modified",
        httpStatus: 304,
        jobs: [],
        errorMessage: null,
        errorDetail: null,
        etag: null,
        lastModified: null,
      };
    } else {
      outcome = {
        status: "failure",
        httpStatus: response.status,
        jobs: [],
        errorMessage: response.message,
        errorDetail: { attempts: response.attempts, url },
        etag: null,
        lastModified: null,
      };
    }

    const result = await persistPull(db, {
      companyId: company.id,
      source: company.ats_source,
      batchId,
      startedAt,
      outcome,
    });

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalClosed += result.closed;

    const label = company.name.padEnd(14);
    if (outcome.status === "failure") {
      failures += 1;
      console.log(`  FAILED   ${label} ${outcome.errorMessage}`);
    } else if (result.note) {
      failures += 1;
      console.log(`  SUSPECT  ${label} ${result.note}`);
    } else if (outcome.status === "not_modified") {
      console.log(`  304      ${label} unchanged`);
    } else {
      console.log(
        `  ok       ${label} ${String(outcome.jobs.length).padStart(4)} jobs` +
          `  +${result.created} new  ~${result.updated} seen  -${result.closed} closed`,
      );
    }
  }

  console.log(
    `\n${totalCreated} created, ${totalUpdated} updated, ${totalClosed} closed` +
      (failures > 0 ? `, ${failures} needing attention` : ""),
  );
  console.log(`Run history: /settings/runs`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
