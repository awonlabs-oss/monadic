import { searchJobs, feedStats, jobFacets } from "@/lib/data/jobs";
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
 * The main column fills the viewport rather than sitting inside a max-width.
 * The cap was mine, not the design's — DESIGN.md §4 specifies the sidebar width
 * and the main column's padding and says nothing about capping it — and on a
 * wide screen it left most of the display empty.
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
    feedStats(filters.usOnly),
    jobFacets(filters),
  ]);

  // Cities, most-common first. Capped because the long tail is one-offs like
  // "Foster City" that nobody scrolls a filter list to find, and any currently
  // selected city is kept regardless so a filter can always be switched off.
  // The facet encodes slug and display name together, since the filter value is
  // the slug but the label has to be the name.
  const companies = Object.entries(facets.companyName ?? {})
    .map(([composite, n]) => {
      const [slug, name] = composite.split("\t");
      return { slug, name: name ?? slug, n };
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  const cities = Object.entries(facets.city ?? {})
    .map(([name, n]) => ({ name, n }))
    .filter((c) => c.n >= 3 || filters.cities.includes(c.name))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, 20);

  // A filter change can shorten the result set below the current page.
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pastEnd = jobs.length === 0 && total > 0 && filters.page > lastPage;

  return (
    <div className="flex flex-col gap-loose">
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
              {stats.openJobs.toLocaleString()} open {filters.usOnly ? "US " : ""}
              roles from {stats.companies} companies
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
          {/* Filters survive a search submit. */}
          {filters.years && <input type="hidden" name="years" value={filters.years} />}
          {filters.comp && <input type="hidden" name="comp" value={filters.comp} />}
          {filters.remote.map((r) => (
            <input key={r} type="hidden" name="remote" value={r} />
          ))}
          {!filters.includeYearsUnknown && <input type="hidden" name="yrsunk" value="0" />}
          {!filters.includeCompUnknown && <input type="hidden" name="compunk" value="0" />}
          {filters.searchDescriptions && <input type="hidden" name="desc" value="1" />}
          {filters.recency && <input type="hidden" name="recency" value={filters.recency} />}
          {filters.cities.map((c) => (
            <input key={c} type="hidden" name="city" value={c} />
          ))}
          {filters.companies.map((c) => (
            <input key={c} type="hidden" name="company" value={c} />
          ))}
          {!filters.usOnly && <input type="hidden" name="intl" value="1" />}
          <button
            type="submit"
            className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
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
              className={`rounded-subtle px-compact py-tight text-small font-medium transition-colors ${
                filters.searchDescriptions
                  ? "bg-accent-default text-content-inverse hover:bg-accent-hover"
                  : "border border-border-subtle bg-surface-base text-content-secondary hover:bg-surface-hover hover:text-content-primary"
              }`}
            >
              {filters.searchDescriptions ? "Searching descriptions" : "Search descriptions too"}
            </Link>
          )}
        </form>

        <FilterPanel filters={filters} facets={facets} total={total} cities={cities} companies={companies} />
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
