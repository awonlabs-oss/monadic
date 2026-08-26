import { searchJobs, feedStats, jobFacets } from "@/lib/data/jobs";
import { parseFilters, activeCount, hrefFor } from "@/lib/filters";
import { JobCard } from "@/components/job-card";
import { FilterPanel } from "@/components/filter-panel";
import { Pagination } from "@/components/pagination";
import Link from "next/link";

/*
 * /jobs — the feed.
 *
 * Default sort is the board's own posted date, not first_seen_at. Everything
 * currently in the database was first seen inside one 53-second ingestion run,
 * so first_seen_at ordering returned whichever company was pulled last rather
 * than anything resembling recency — the first page was 48 Vercel postings.
 * "Newest to me" keeps first_seen_at available, because once ingestion runs
 * regularly that becomes a genuinely different and useful question.
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);
  const filtered = activeCount(filters) > 0;
  const offset = (filters.page - 1) * PAGE_SIZE;

  const [{ jobs, total }, stats, facets] = await Promise.all([
    searchJobs(filters, PAGE_SIZE, offset),
    feedStats(),
    jobFacets(filters),
  ]);

  // A filter change can shorten the result set below the current page.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pastEnd = jobs.length === 0 && total > 0 && filters.page > lastPage;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-loose">
      <header className="flex flex-col gap-tight">
        <h1 className="text-title font-semibold tracking-tight text-content-primary">
          New jobs
        </h1>
        <p className="text-body text-content-secondary">
          {filtered ? (
            <>
              {total.toLocaleString()} matching {total === 1 ? "role" : "roles"} of{" "}
              {stats.openJobs.toLocaleString()}
            </>
          ) : (
            <>
              {stats.openJobs.toLocaleString()} open roles from {stats.companies} companies
            </>
          )}
        </p>
      </header>

      <search className="flex flex-col gap-snug">
        <form method="get" action="/jobs" className="flex flex-wrap items-center gap-tight">
          <label htmlFor="job-search" className="sr-only">
            Search job titles
          </label>
          <input
            id="job-search"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search roles and companies"
            className="w-72 max-w-full rounded-subtle border border-border-subtle bg-surface-base px-default py-compact text-small text-content-primary placeholder:text-content-tertiary"
          />
          {/* Filters and sort survive a search submit. */}
          {filters.years && <input type="hidden" name="years" value={filters.years} />}
          {filters.comp && <input type="hidden" name="comp" value={filters.comp} />}
          {filters.remote.map((r) => (
            <input key={r} type="hidden" name="remote" value={r} />
          ))}
          {!filters.includeYearsUnknown && <input type="hidden" name="yrsunk" value="0" />}
          {!filters.includeCompUnknown && <input type="hidden" name="compunk" value="0" />}
          {filters.searchDescriptions && <input type="hidden" name="desc" value="1" />}
          {filters.sort !== "posted" && <input type="hidden" name="sort" value={filters.sort} />}
          <button
            type="submit"
            className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse"
          >
            Search
          </button>
          {filters.q && (
            <Link
              href={hrefFor(filters, {
                searchDescriptions: !filters.searchDescriptions,
                page: 1,
              })}
              aria-pressed={filters.searchDescriptions}
              className={`rounded-subtle px-compact py-tight text-small font-medium ${
                filters.searchDescriptions
                  ? "bg-accent-default text-content-inverse"
                  : "border border-border-subtle bg-surface-base text-content-secondary"
              }`}
            >
              {filters.searchDescriptions ? "Searching descriptions" : "Search descriptions too"}
            </Link>
          )}
        </form>

        <FilterPanel filters={filters} facets={facets} total={total} />
      </search>

      {jobs.length === 0 ? (
        <p className="text-body text-content-secondary">
          {pastEnd ? (
            <>
              That page no longer exists — this search has {total.toLocaleString()}{" "}
              {total === 1 ? "result" : "results"}.{" "}
              <Link href={hrefFor(filters, { page: 1 })} className="underline underline-offset-2">
                Back to the first page
              </Link>
              .
            </>
          ) : filtered ? (
            "No roles match these filters. The counts in the panel show what each option would return."
          ) : (
            "No open postings yet. Run npm run resolve, then npm run ingest."
          )}
        </p>
      ) : (
        <section aria-labelledby="feed-heading" className="flex flex-col gap-loose">
          <h2 id="feed-heading" className="sr-only">
            {filtered ? "Matching job postings" : "Job postings"}
          </h2>

          <ul className="grid grid-cols-1 gap-loose min-[1100px]:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>

          <Pagination filters={filters} total={total} pageSize={PAGE_SIZE} />
        </section>
      )}
    </div>
  );
}
