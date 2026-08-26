import Link from "next/link";
import {
  COMP_BUCKETS,
  REMOTE_OPTIONS,
  YEARS_BUCKETS,
  activeCount,
  toggleHref,
  type JobFilters,
} from "@/lib/filters";

/**
 * FilterBar. Active pills are ink-filled, inactive are white and bordered,
 * per the FilterPill entry in DESIGN.md §5.
 *
 * Every control is a link or a GET form — no client JavaScript, no filter
 * state anywhere but the URL. A filtered feed is therefore shareable and
 * survives a reload, and the back button does what it should.
 *
 * aria-pressed carries the active state, so the ink fill is never the only
 * signal (DESIGN.md §9).
 */

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full px-default py-compact text-small font-medium leading-none ${
        active
          ? "bg-accent-default text-content-inverse"
          : "border border-border-subtle bg-surface-base text-content-secondary"
      }`}
    >
      {children}
    </Link>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-tight">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="pr-tight text-caption text-content-tertiary">
        {label}
      </span>
      {children}
    </fieldset>
  );
}

export function FilterBar({ filters }: { filters: JobFilters }) {
  const active = activeCount(filters);

  return (
    <search className="flex flex-col gap-snug">
      <div className="flex flex-wrap items-center justify-between gap-snug">
        {/*
          GET form: the browser serialises this into the same querystring the
          pills produce, so search and filters compose without any extra wiring.
        */}
        <form method="get" action="/jobs" className="flex items-center gap-tight">
          <label htmlFor="job-search" className="sr-only">
            Search job titles and descriptions
          </label>
          <input
            id="job-search"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search roles and companies"
            className="w-72 max-w-full rounded-full border border-border-subtle bg-surface-base px-default py-compact text-small text-content-primary placeholder:text-content-tertiary"
          />
          {/* Filters survive a search submit. */}
          {filters.years && <input type="hidden" name="years" value={filters.years} />}
          {filters.comp && <input type="hidden" name="comp" value={filters.comp} />}
          {filters.remote.length > 0 && (
            <input type="hidden" name="remote" value={filters.remote.join(",")} />
          )}
          {!filters.includeYearsUnknown && <input type="hidden" name="yrsunk" value="0" />}
          {!filters.includeCompUnknown && <input type="hidden" name="compunk" value="0" />}
          {filters.searchDescriptions && <input type="hidden" name="desc" value="1" />}
          <button
            type="submit"
            className="rounded-full bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse"
          >
            Search
          </button>
        </form>

        {filters.q && (
          <Pill
            href={toggleHref(filters, { desc: filters.searchDescriptions ? null : "1" })}
            active={filters.searchDescriptions}
          >
            {filters.searchDescriptions ? "Searching descriptions" : "Search descriptions too"}
          </Pill>
        )}

        {active > 0 && (
          <Link
            href="/jobs"
            className="text-small text-content-secondary underline underline-offset-2"
          >
            Clear {active} filter{active === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-tight">
        <Group label="Experience">
          {YEARS_BUCKETS.map((bucket) => (
            <Pill
              key={bucket.key}
              href={toggleHref(filters, {
                years: filters.years === bucket.key ? null : bucket.key,
              })}
              active={filters.years === bucket.key}
            >
              {bucket.label}
            </Pill>
          ))}
          {/*
            30% of postings state no years. Excluding them is a real choice, so
            it is an explicit control rather than a side effect of filtering.
          */}
          {filters.years && (
            <Pill
              href={toggleHref(filters, {
                yrsunk: filters.includeYearsUnknown ? "0" : null,
              })}
              active={!filters.includeYearsUnknown}
            >
              {filters.includeYearsUnknown ? "Hide unstated" : "Unstated hidden"}
            </Pill>
          )}
        </Group>

        <Group label="Pay">
          {COMP_BUCKETS.map((bucket) => (
            <Pill
              key={bucket.key}
              href={toggleHref(filters, {
                comp: filters.comp === bucket.key ? null : bucket.key,
              })}
              active={filters.comp === bucket.key}
            >
              {bucket.label}
            </Pill>
          ))}
          {filters.comp && (
            <Pill
              href={toggleHref(filters, {
                compunk: filters.includeCompUnknown ? "0" : null,
              })}
              active={!filters.includeCompUnknown}
            >
              {filters.includeCompUnknown ? "Hide unlisted" : "Unlisted hidden"}
            </Pill>
          )}
        </Group>

        <Group label="Location">
          {REMOTE_OPTIONS.map((option) => (
            <Pill
              key={option.key}
              href={toggleHref(filters, { remote: option.key })}
              active={filters.remote.includes(option.key)}
            >
              {option.label}
            </Pill>
          ))}
        </Group>
      </div>
    </search>
  );
}
