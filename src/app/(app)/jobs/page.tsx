import { searchJobs, feedStats, jobFacets } from "@/lib/data/jobs";
import { appliedJobIds } from "@/lib/data/applications";
import { parseFilters, activeCount, hrefFor } from "@/lib/filters";
import { JobCard } from "@/components/job-card";
import { FilterPanel } from "@/components/filter-panel";
import { Pagination } from "@/components/pagination";
import Link from "next/link";

/*
 * /jobs — the feed.
 *
 * One ordering, newest posted first. Not first_seen_at: everything in the
 * database was first seen inside a single 53-second ingestion run, so ordering
 * by it returned whichever company was pulled last rather than anything
 * resembling recency.
 *
 * One column of full-width cards, with the profile dock docked to the right
 * (frame `Screen / Home (feed + profile dock)`, 22:471).
 * The column fills what is left rather than sitting inside a max-width.
 *
 * "For You" rather than "New jobs": the ordering is recency, but what makes the
 * list worth reading is that it is filtered to what you are looking for, and
 * the dock beside it is what states that.
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

  const [{ jobs, total }, stats, facets, applied] = await Promise.all([
    searchJobs(filters, PAGE_SIZE, offset),
    feedStats(filters.usOnly),
    jobFacets(filters),
    // Which of these have already gone in, so the card offers the posting
    // rather than Apply. Fetched alongside the feed rather than per card:
    // one keyed read for the page, not one per row.
    appliedJobIds(),
  ]);

  // Cities, most-common first. Capped because the long tail is one-offs like
  // "Foster City" that nobody scrolls a filter list to find, and any currently
  // selected city is kept regardless so a filter can always be switched off.
  const cities = Object.entries(facets.city ?? {})
    .map(([name, n]) => ({ name, n }))
    .filter((c) => c.n >= 3 || filters.cities.includes(c.name))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, 20);

  // A filter change can shorten the result set below the current page.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pastEnd = jobs.length === 0 && total > 0 && filters.page > lastPage;

  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col gap-snug px-page pt-section pb-page">
        {/*
        Title left, search right, on one line — frame 22:471. The search box was
        on its own row under the heading; it is the same size as the filter
        controls and there is nothing else at the top of the page competing for
        that space.
      */}
        <header className="flex flex-wrap items-start justify-between gap-snug pb-tight">
          <div className="flex flex-col gap-tight">
            {/*
              The serif, used once. A page title is the one place on a feed
              where a person is addressed rather than a row scanned, so it is
              also the only place the display face earns its keep — everything
              below this line is Figtree, because everything below it is data.
            */}
            <h1 className="font-display text-display font-semibold italic leading-tight tracking-tight text-content-primary">
              All jobs
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
                  {stats.openJobs.toLocaleString()} open{" "}
                  {filters.usOnly ? "US " : ""}
                  roles from {stats.companies} companies
                </>
              )}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-end gap-tight">
            <form
              method="get"
              action="/jobs"
              role="search"
              className="flex flex-wrap items-center justify-end gap-tight"
            >
              <label htmlFor="job-search" className="sr-only">
                Search job titles
              </label>
              <input
                id="job-search"
                type="search"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Search roles and companies"
                className="w-64 max-w-full rounded-subtle border border-border-subtle bg-surface-base px-default py-compact text-small text-content-primary placeholder:text-content-tertiary"
              />
              {/* Filters survive a search submit. */}
              {filters.years && (
                <input type="hidden" name="years" value={filters.years} />
              )}
              {filters.comp && (
                <input type="hidden" name="comp" value={filters.comp} />
              )}
              {filters.remote.map((r) => (
                <input key={r} type="hidden" name="remote" value={r} />
              ))}
              {!filters.includeYearsUnknown && (
                <input type="hidden" name="yrsunk" value="0" />
              )}
              {!filters.includeCompUnknown && (
                <input type="hidden" name="compunk" value="0" />
              )}
              {filters.searchDescriptions && (
                <input type="hidden" name="desc" value="1" />
              )}
              {filters.recency && (
                <input type="hidden" name="recency" value={filters.recency} />
              )}
              {filters.cities.map((c) => (
                <input key={c} type="hidden" name="city" value={c} />
              ))}
              {!filters.usOnly && <input type="hidden" name="intl" value="1" />}
              {!filters.diversify && (
                <input type="hidden" name="mix" value="0" />
              )}
              <button
                type="submit"
                className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
              >
                Search
              </button>
            </form>

            {/*
          Outside the form: it is a link that re-runs the search with the
          descriptions included, not a control the form submits.
        */}
            {filters.q && (
              <Link
                href={hrefFor(filters, {
                  searchDescriptions: !filters.searchDescriptions,
                  page: 1,
                })}
                aria-pressed={filters.searchDescriptions}
                className={`rounded-subtle px-compact py-tight text-small font-medium transition-colors ${
                  filters.searchDescriptions
                    ? "bg-accent-default text-content-inverse hover:bg-accent-hover"
                    : "border border-border-subtle bg-surface-base text-content-secondary hover:bg-surface-hover hover:text-content-primary"
                }`}
              >
                {filters.searchDescriptions
                  ? "Searching descriptions"
                  : "Search descriptions too"}
              </Link>
            )}
          </div>
        </header>

        <FilterPanel
          filters={filters}
          facets={facets}
          total={total}
          cities={cities}
        />

        {jobs.length === 0 ? (
          <p className="text-body text-content-secondary">
            {pastEnd ? (
              <>
                That page no longer exists — this search has{" "}
                {total.toLocaleString()} {total === 1 ? "result" : "results"}.{" "}
                <Link
                  href={hrefFor(filters, { page: 1 })}
                  className="underline underline-offset-2"
                >
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
          <section
            aria-labelledby="feed-heading"
            className="flex flex-col gap-snug"
          >
            <h2 id="feed-heading" className="sr-only">
              {filtered ? "Matching job postings" : "Job postings"}
            </h2>

            {/*
            One column, 14px apart (frame 22:471). The two-column grid fit more
            cards on screen and made every one of them worse: each card had to
            stretch to the height of its neighbour, and the title — the thing
            you actually scan — had half the width to sit on.
          */}
            <ul className="flex flex-col gap-snug">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} applied={applied.has(job.id)} />
                </li>
              ))}
            </ul>

            {/*
            Said out loud because it is a real deviation from "newest first" and
            an unexplained reordering is indistinguishable from a bug.
          */}
            {filters.diversify && !filters.q && (
              <p className="text-caption text-content-tertiary">
                Showing at most 2 roles per company so more companies fit on a
                page.{" "}
                <Link
                  href={hrefFor(filters, { diversify: false, page: 1 })}
                  className="underline underline-offset-2 hover:text-content-primary"
                >
                  Order strictly by date
                </Link>
              </p>
            )}
            {!filters.diversify && (
              <p className="text-caption text-content-tertiary">
                Ordered strictly by date, so one company can fill the page.{" "}
                <Link
                  href={hrefFor(filters, { diversify: true, page: 1 })}
                  className="underline underline-offset-2 hover:text-content-primary"
                >
                  Mix companies
                </Link>
              </p>
            )}

            <Pagination filters={filters} total={total} pageSize={PAGE_SIZE} />
          </section>
        )}
      </div>
    </div>
  );
}
