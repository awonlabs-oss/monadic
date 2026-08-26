import { recentRuns, companyHealth } from "@/lib/data/runs";
import { formatDuration, relativeDays } from "@/lib/format";

/*
 * Ingestion health. Structure and tokens only — DESIGN.md is OPEN throughout.
 *
 * This screen exists because a pipeline that quietly returns nothing is the
 * main way something like this rots. Everything here is chosen to make that
 * visible: the status of every run, whether closure was applied, and which
 * companies never resolved to a board at all.
 */

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  success: "OK",
  empty_suspect: "Suspect",
  not_modified: "Unchanged",
  skipped_unresolved: "Skipped",
  failure: "Failed",
};

/*
 * Status is carried by the label itself, never by color alone — DESIGN.md §9 is
 * DECIDED on that. The token only reinforces what the word already says.
 *
 * Both attention states use status/stale because it is the only attention color
 * the Figma palette defines. DESIGN.md §7 lists the failed-run treatment as
 * OPEN and there is no danger token, so nothing is invented here.
 */
const STATUS_TONE: Record<string, string> = {
  success: "text-content-secondary",
  empty_suspect: "text-status-stale",
  not_modified: "text-content-tertiary",
  skipped_unresolved: "text-content-tertiary",
  failure: "text-status-stale",
};

export default async function RunsPage() {
  const [runs, companies] = await Promise.all([recentRuns(40), companyHealth()]);

  const needsAttention = runs.filter(
    (r) => r.status === "failure" || r.status === "empty_suspect",
  );
  const unresolved = companies.filter((c) => c.ats_resolution_status !== "resolved");

  return (
    <div className="flex flex-col gap-loose">
      <header className="flex flex-col gap-compact">
        <h1 className="text-title font-semibold">Ingestion</h1>
        <p className="text-content-secondary text-small">
          {runs.length === 0
            ? "No runs recorded yet."
            : `Last run ${relativeDays(runs[0].started_at)}. ` +
              `${needsAttention.length} of the last ${runs.length} need attention.`}
        </p>
      </header>

      {unresolved.length > 0 && (
        <section aria-labelledby="unresolved-heading" className="flex flex-col gap-compact">
          <h2 id="unresolved-heading" className="text-lead font-medium">
            Companies without a board ({unresolved.length})
          </h2>
          <p className="text-small text-content-secondary">
            Resolution is cached permanently, including failures. Retry one with{" "}
            <code>npm run resolve -- --force &lt;slug&gt;</code>.
          </p>
          <ul className="flex flex-col gap-tight">
            {unresolved.map((company) => (
              <li
                key={company.id}
                className="border border-border-subtle rounded-default p-compact flex flex-wrap gap-compact text-small"
              >
                <span className="font-medium">{company.name}</span>
                <span className="text-content-tertiary">{company.slug}</span>
                <span className="text-status-stale">
                  {company.ats_resolution_error ?? company.ats_resolution_status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="companies-heading" className="flex flex-col gap-compact">
        <h2 id="companies-heading" className="text-lead font-medium">
          Boards ({companies.filter((c) => c.ats_resolution_status === "resolved").length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <caption className="sr-only">
              Resolved companies, their applicant tracking system, and open posting counts
            </caption>
            <thead>
              <tr className="text-left text-content-secondary">
                <th scope="col" className="p-tight">Company</th>
                <th scope="col" className="p-tight">ATS</th>
                <th scope="col" className="p-tight">Board slug</th>
                <th scope="col" className="p-tight">Resolved via</th>
                <th scope="col" className="p-tight">Open jobs</th>
              </tr>
            </thead>
            <tbody>
              {companies
                .filter((c) => c.ats_resolution_status === "resolved")
                .map((company) => (
                  <tr key={company.id} className="border-t border-border-subtle">
                    <td className="p-tight">{company.name}</td>
                    <td className="p-tight">{company.ats_source}</td>
                    <td className="p-tight text-content-secondary">{company.ats_slug}</td>
                    <td className="p-tight text-content-secondary">
                      {company.ats_resolution_method}
                    </td>
                    <td className="p-tight">{company.open_jobs.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="runs-heading" className="flex flex-col gap-compact">
        <h2 id="runs-heading" className="text-lead font-medium">
          Recent runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-content-secondary">
            Nothing yet. Run <code>npm run ingest</code>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <caption className="sr-only">
                Every board fetch, with status, counts, and whether closure detection ran
              </caption>
              <thead>
                <tr className="text-left text-content-secondary">
                  <th scope="col" className="p-tight">Company</th>
                  <th scope="col" className="p-tight">Source</th>
                  <th scope="col" className="p-tight">Status</th>
                  <th scope="col" className="p-tight">HTTP</th>
                  <th scope="col" className="p-tight">Returned</th>
                  <th scope="col" className="p-tight">New</th>
                  <th scope="col" className="p-tight">Closed</th>
                  <th scope="col" className="p-tight">Closure ran</th>
                  <th scope="col" className="p-tight">Took</th>
                  <th scope="col" className="p-tight">When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-border-subtle">
                    <td className="p-tight">{run.company_name ?? "—"}</td>
                    <td className="p-tight text-content-secondary">{run.source ?? "—"}</td>
                    <td className={`p-tight ${STATUS_TONE[run.status] ?? ""}`}>
                      {STATUS_LABEL[run.status] ?? run.status}
                    </td>
                    <td className="p-tight text-content-secondary">{run.http_status ?? "—"}</td>
                    <td className="p-tight">{run.jobs_returned ?? "—"}</td>
                    <td className="p-tight">{run.jobs_created ?? "—"}</td>
                    <td className="p-tight">{run.jobs_closed ?? "—"}</td>
                    <td className="p-tight text-content-secondary">
                      {run.closure_applied ? "yes" : "no"}
                    </td>
                    <td className="p-tight text-content-secondary">
                      {formatDuration(run.duration_ms)}
                    </td>
                    <td className="p-tight text-content-secondary">
                      {relativeDays(run.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {needsAttention.length > 0 && (
          <ul className="flex flex-col gap-tight">
            {needsAttention.map((run) => (
              <li key={run.id} className="text-small text-status-stale">
                {run.company_name}: {run.error_message ?? run.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
