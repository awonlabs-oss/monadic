import { searchJobs, feedStats } from "@/lib/data/jobs";
import { parseFilters, activeCount } from "@/lib/filters";
import { JobCard } from "@/components/job-card";
import { FilterBar } from "@/components/filter-bar";

/*
 * /jobs — the feed.
 *
 * The subtitle says what a person looking for work would want to know: how many
 * roles are here and how many the current filters left. It used to report the
 * share of postings stating compensation, which is a fact about the ingestion
 * pipeline, not about the job hunt — it belongs on /settings/runs and now
 * lives only there.
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const filtered = activeCount(filters) > 0;

  const [{ jobs, total }, stats] = await Promise.all([
    searchJobs(filters, PAGE_SIZE),
    feedStats(),
  ]);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-loose">
      <header className="flex flex-col gap-tight">
        <h1 className="text-title font-semibold tracking-tight text-content-primary">
          New jobs
        </h1>
        <p className="text-body text-content-secondary">
          {filtered ? (
            <>
              {total.toLocaleString()} matching{" "}
              {total === 1 ? "role" : "roles"} of{" "}
              {stats.openJobs.toLocaleString()}
            </>
          ) : (
            <>
              {stats.openJobs.toLocaleString()} open roles from {stats.companies}{" "}
              companies
            </>
          )}
        </p>
      </header>

      <FilterBar filters={filters} />

      {jobs.length === 0 ? (
        <p className="text-body text-content-secondary">
          {filtered
            ? "No roles match these filters. Try widening the experience or pay range."
            : "No open postings yet. Run npm run resolve, then npm run ingest."}
        </p>
      ) : (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-snug">
          <h2 id="feed-heading" className="sr-only">
            {filtered ? "Matching job postings" : "Job postings, newest first"}
          </h2>

          <ul className="grid grid-cols-1 gap-loose min-[1100px]:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>

          {total > jobs.length && (
            <p className="text-caption text-content-tertiary">
              Showing {jobs.length} of {total.toLocaleString()}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
