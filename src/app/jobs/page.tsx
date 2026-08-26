import { listJobs, feedStats } from "@/lib/data/jobs";
import { JobCard } from "@/components/job-card";

/*
 * /jobs — the feed. Figma frame `Screen / Jobs feed` (3:2), page `monadic — v0`.
 *
 * Two-column card grid at 1440, single column below 1100, per DESIGN.md
 * section 4. The 22px gutter is space/loose.
 *
 * Not built here, and deliberately not faked:
 *  - The filter bar. Filters are real work over real columns and the pills would
 *    otherwise be decorative controls that do nothing.
 *  - The search field, for the same reason.
 *  - "6 match your saved criteria" in the subtitle — that is a scoring claim,
 *    and scoring is out of Phase 1 scope.
 * The subtitle states only what can actually be counted.
 */

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const [{ jobs, total }, stats] = await Promise.all([
    listJobs({ limit: 48 }),
    feedStats(),
  ]);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-loose">
      <header className="flex flex-col gap-tight">
        <h1 className="text-title font-semibold tracking-tight text-content-primary">
          New jobs
        </h1>
        <p className="text-body text-content-secondary">
          {stats.openJobs.toLocaleString()} open postings across {stats.companies}{" "}
          boards · {stats.withComp.toLocaleString()} state compensation
        </p>
      </header>

      {jobs.length === 0 ? (
        <p className="text-body text-content-secondary">
          No open postings yet. Run <code>npm run resolve</code>, then{" "}
          <code>npm run ingest</code>.
        </p>
      ) : (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-snug">
          <h2 id="feed-heading" className="sr-only">
            Job postings, newest first
          </h2>

          <ul className="grid grid-cols-1 gap-loose min-[1100px]:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>

          <p className="text-caption text-content-tertiary">
            Showing {jobs.length} of {total.toLocaleString()}
          </p>
        </section>
      )}
    </div>
  );
}
