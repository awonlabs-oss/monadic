import { listJobs, feedStats } from "@/lib/data/jobs";
import { formatComp, formatYears, formatRemote, relativeDays } from "@/lib/format";

/*
 * DESIGN.md marks every visual section OPEN, so this is structure only:
 * semantic HTML, correct heading order, and nothing but token utilities. It is
 * meant to look plain. Filters, saving and dismissing are not here yet.
 *
 * Absence is rendered as a labelled reason rather than a dash, because a dash
 * would stand for four different things — not listed, not stated, not parsed,
 * and not applicable. Nearly 60% of these postings state no compensation, so
 * that is the common case rather than an edge one.
 */

export const dynamic = "force-dynamic";

function Missing({ reason }: { reason: string }) {
  return <span className="text-content-tertiary">{reason}</span>;
}

export default async function JobsPage() {
  const [{ jobs, total }, stats] = await Promise.all([listJobs({ limit: 50 }), feedStats()]);

  return (
    <div className="flex flex-col gap-loose">
      <header className="flex flex-col gap-compact">
        <h1 className="text-title font-semibold">Jobs</h1>
        <dl className="flex flex-wrap gap-loose text-small">
          {[
            { label: "Open postings", value: stats.openJobs.toLocaleString() },
            { label: "Companies", value: String(stats.companies) },
            {
              label: "State compensation",
              value: `${stats.withComp.toLocaleString()} of ${stats.openJobs.toLocaleString()}`,
            },
            { label: "Added this week", value: stats.addedThisWeek.toLocaleString() },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <dt className="text-content-secondary">{stat.label}</dt>
              <dd className="text-lead font-medium">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {jobs.length === 0 ? (
        <p className="text-content-secondary">
          No open postings yet. Run <code>npm run resolve</code> then{" "}
          <code>npm run ingest</code> to pull boards.
        </p>
      ) : (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-compact">
          <h2 id="feed-heading" className="text-small text-content-secondary">
            Showing {jobs.length} of {total.toLocaleString()}, newest first
          </h2>

          <ul className="flex flex-col gap-compact">
            {jobs.map((job) => {
              const comp = formatComp(job);
              const years = formatYears(job);
              const remote = formatRemote(job.remote_policy);

              return (
                <li
                  key={job.id}
                  className="border border-border-subtle rounded-default p-comfortable flex flex-col gap-tight"
                >
                  <div className="flex flex-wrap items-baseline gap-compact">
                    <h3 className="text-lead font-medium">
                      {job.url ? (
                        <a href={job.url} target="_blank" rel="noreferrer noopener">
                          {job.title}
                        </a>
                      ) : (
                        job.title
                      )}
                    </h3>
                    <p className="text-content-secondary">{job.company_name}</p>
                  </div>

                  <dl className="flex flex-wrap gap-comfortable text-small">
                    <div className="flex gap-tight">
                      <dt className="text-content-tertiary">Comp</dt>
                      <dd>
                        {comp.known ? (
                          <>
                            <span className="font-medium">{comp.value}</span>
                            {comp.caveat && (
                              <span className="text-content-tertiary"> ({comp.caveat})</span>
                            )}
                          </>
                        ) : (
                          <Missing reason={comp.reason} />
                        )}
                      </dd>
                    </div>

                    <div className="flex gap-tight">
                      <dt className="text-content-tertiary">Experience</dt>
                      <dd>
                        {years.known ? (
                          <>
                            {years.value}
                            {years.caveat && (
                              <span className="text-content-tertiary"> ({years.caveat})</span>
                            )}
                          </>
                        ) : (
                          <Missing reason={years.reason} />
                        )}
                      </dd>
                    </div>

                    <div className="flex gap-tight">
                      <dt className="text-content-tertiary">Location</dt>
                      <dd>
                        {job.location_raw ?? <Missing reason="Not stated" />}
                        {remote.known && (
                          <span className="text-content-secondary"> · {remote.value}</span>
                        )}
                      </dd>
                    </div>

                    <div className="flex gap-tight">
                      <dt className="text-content-tertiary">Seen</dt>
                      <dd>{relativeDays(job.first_seen_at)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
