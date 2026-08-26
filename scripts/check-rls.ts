/**
 * Proves the RLS policies actually bite, through the same client the app uses.
 *
 * This is the permanent version of the one-off probe run when the schema was
 * first deployed. It exists because RLS has a failure mode that testing by hand
 * misses: a blocked UPDATE or DELETE does not raise — the policy filters the row
 * set, so the statement succeeds having affected nothing. An assertion written
 * against empty tables therefore passes whether or not the policy exists.
 *
 * So the append-only checks below create a real row first, and assert on the
 * count of rows affected rather than on whether an error was thrown.
 *
 * Everything is cleaned up on the way out.
 *
 *   npm run check:rls
 */

import { getServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { localUserEnv } from "@/lib/env";

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
}

const OTHER_USER = "00000000-0000-0000-0000-0000000000ff";

async function main() {
  const user = localUserEnv();
  const app = await getServerClient();
  const admin = createServiceClient();

  // ---------------------------------------------------------------------
  // Reads on global tables must work.
  // ---------------------------------------------------------------------
  const reasons = await app.from("dismissal_reasons").select("code");
  record(
    "read dismissal_reasons (global)",
    !reasons.error && (reasons.data?.length ?? 0) > 0,
    reasons.error ? reasons.error.message : `${reasons.data?.length} rows`,
  );

  const jobsRead = await app.from("jobs").select("id").limit(1);
  record("read jobs (global)", !jobsRead.error, jobsRead.error?.message ?? "ok");

  // ---------------------------------------------------------------------
  // Writes on ingestion-owned tables must be refused.
  // ---------------------------------------------------------------------
  const companyWrite = await app
    .from("companies")
    .insert({ name: "rls probe", slug: `rls-probe-${Date.now()}` });
  record(
    "insert companies as app user",
    companyWrite.error !== null,
    companyWrite.error ? "refused" : "*** ALLOWED ***",
  );

  // ---------------------------------------------------------------------
  // Writes owned by another user must be refused.
  // ---------------------------------------------------------------------
  const foreignWrite = await app
    .from("search_criteria")
    .insert({ user_id: OTHER_USER });
  record(
    "insert search_criteria for another user",
    foreignWrite.error !== null,
    foreignWrite.error ? "refused" : "*** ALLOWED ***",
  );

  // ---------------------------------------------------------------------
  // Append-only, asserted against a real row.
  // ---------------------------------------------------------------------
  // Set up a job to hang an application off. Global tables, so service client.
  const slug = `rls-probe-${Date.now()}`;
  const company = await admin
    .from("companies")
    .insert({ name: "RLS Probe Co", slug })
    .select("id")
    .single();
  if (company.error) throw new Error(`probe setup failed: ${company.error.message}`);

  const job = await admin
    .from("jobs")
    .insert({
      company_id: company.data.id,
      source: "lever",
      source_job_id: slug,
      title: "RLS Probe Engineer",
      raw: {},
    })
    .select("id")
    .single();
  if (job.error) throw new Error(`probe setup failed: ${job.error.message}`);

  try {
    // Exercise the real write path, as the app user, through the RPCs.
    const created = await app.rpc("create_application", {
      p_job_id: job.data.id,
      p_source: "job_feed",
    });
    record(
      "create_application() as app user",
      !created.error,
      created.error?.message ?? "ok",
    );

    const applicationId = (created.data as { id: string } | null)?.id;

    if (applicationId) {
      const advanced = await app.rpc("set_application_status", {
        p_application_id: applicationId,
        p_status: "applied",
        p_note: "rls probe",
      });
      record(
        "set_application_status() as app user",
        !advanced.error &&
          (advanced.data as { status: string } | null)?.status === "applied",
        advanced.error?.message ??
          `status=${(advanced.data as { status: string } | null)?.status}`,
      );

      const events = await app
        .from("application_events")
        .select("id")
        .eq("application_id", applicationId);
      record(
        "timeline events written and visible",
        !events.error && (events.data?.length ?? 0) === 2,
        events.error?.message ?? `${events.data?.length} events (want 2)`,
      );

      // The real assertion: rows exist, so a working policy shows up as zero
      // rows affected rather than as an error.
      const updated = await app
        .from("application_events")
        .update({ title: "tampered" })
        .eq("application_id", applicationId)
        .select("id");
      record(
        "update application_events (rows present)",
        (updated.data?.length ?? 0) === 0,
        `${updated.data?.length ?? 0} rows affected (want 0)`,
      );

      const deleted = await app
        .from("application_events")
        .delete()
        .eq("application_id", applicationId)
        .select("id");
      record(
        "delete application_events (rows present)",
        (deleted.data?.length ?? 0) === 0,
        `${deleted.data?.length ?? 0} rows affected (want 0)`,
      );
    }
  } finally {
    // Order matters: applications.job_id is ON DELETE RESTRICT, so the
    // application goes first. It is user data, so it is deleted as the user;
    // its events cascade.
    //
    // Every cleanup error is surfaced. An earlier version ignored them, the
    // deletes silently failed for want of a grant, and the probe's fake company
    // and job survived in the job feed looking like real postings. Cleanup that
    // cannot fail loudly is not cleanup.
    const cleanupErrors: string[] = [];

    const appDel = await app.from("applications").delete().eq("job_id", job.data.id);
    if (appDel.error) cleanupErrors.push(`applications: ${appDel.error.message}`);

    const jobDel = await admin.from("jobs").delete().eq("id", job.data.id);
    if (jobDel.error) cleanupErrors.push(`jobs: ${jobDel.error.message}`);

    const coDel = await admin.from("companies").delete().eq("id", company.data.id);
    if (coDel.error) cleanupErrors.push(`companies: ${coDel.error.message}`);

    // Confirm the rows are actually gone rather than trusting the absence of an
    // error — a delete filtered to zero rows by RLS reports no error either.
    const leftover = await admin.from("jobs").select("id").eq("id", job.data.id);
    if ((leftover.data?.length ?? 0) > 0) {
      cleanupErrors.push(`jobs: probe row ${job.data.id} still present after delete`);
    }

    if (cleanupErrors.length > 0) {
      record(
        "probe fixtures cleaned up",
        false,
        `LEAKED — ${cleanupErrors.join("; ")}`,
      );
    } else {
      record("probe fixtures cleaned up", true, "no residue");
    }
  }

  // ---------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------
  const width = Math.max(...results.map((r) => r.name.length));
  console.log();
  for (const r of results) {
    console.log(
      `  ${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(width)}  ${r.detail}`,
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n  ${results.length - failed.length}/${results.length} passed as ${user.email}\n`,
  );
  if (failed.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
