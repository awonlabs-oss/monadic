import Link from "next/link";
import {
  COMP_BUCKETS,
  RECENCY,
  REMOTE_OPTIONS,
  YEARS_BUCKETS,
  activeCount,
  hrefFor,
  type JobFilters,
} from "@/lib/filters";
import type { Facets } from "@/lib/data/jobs";

/**
 * Filter controls: a recency row, then a disclosure holding the rest.
 *
 * Recency sits outside the panel because it is reached for most often and
 * should cost one click. The three windows select a subset rather than reorder
 * one, so they are filters — the feed always orders newest posted first
 * underneath.
 *
 * The pay sort is gone. Ordering by pay put every posting that states a salary
 * above every posting that does not, which is 59% of the feed pushed below the
 * fold for a reason that has nothing to do with the job. Pay is a filter.
 *
 * Every option carries a count computed with the other dimensions applied, so a
 * choice that would return nothing reads as zero before it is clicked.
 *
 * There is no company filter. Ninety-four companies made a checkbox list that
 * was longer than everything else combined and still needed scrolling; typing
 * the name into search reaches the same place, now that search matches company
 * names as well as titles.
 */

function Count({ n }: { n: number | undefined }) {
  return (
    <span
      className={`ml-auto pl-tight text-caption tabular-nums ${
        n ? "text-content-tertiary" : "text-content-tertiary/50"
      }`}
    >
      {n ?? 0}
    </span>
  );
}

function Choice({
  type,
  name,
  value,
  checked,
  label,
  count,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex items-center gap-tight rounded-tag px-tight py-xtight text-body text-content-primary transition-colors hover:bg-surface-hover">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={checked}
        className="size-control-box shrink-0 accent-accent-default"
      />
      <span className="truncate">{label}</span>
      {count !== undefined && <Count n={count} />}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-hair">
      <legend className="pb-tight text-caption font-medium uppercase text-content-tertiary">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Chevron mirroring the disclosure state — pointing down when the panel is
 * closed and there is more to open, flipping up when it is open and the click
 * will collapse it.
 */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`size-icon-xs shrink-0 text-content-tertiary transition-transform duration-150 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}

export function FilterPanel({
  filters,
  facets,
  total,
  cities,
}: {
  filters: JobFilters;
  facets: Facets;
  total: number;
  cities: Array<{ name: string; n: number }>;
}) {
  const active = activeCount(filters);

  return (
    <div className="flex flex-col gap-snug">
      <div className="flex flex-wrap items-center gap-tight">
        {RECENCY.map((r) => {
          const on = filters.recency === r.key;
          return (
            <Link
              key={r.key}
              href={hrefFor(filters, { recency: on ? null : r.key, page: 1 })}
              aria-pressed={on}
              className={`inline-flex items-center gap-tight rounded-subtle px-default py-compact text-small font-medium transition-colors ${
                on
                  ? "bg-accent-default text-content-inverse hover:bg-accent-hover"
                  : "border border-border-subtle bg-surface-base text-content-secondary hover:bg-surface-hover hover:text-content-primary"
              }`}
            >
              {r.label}
              <span className="tabular-nums opacity-70">
                {facets.recency?.[r.key] ?? 0}
              </span>
            </Link>
          );
        })}

        <span className="flex-1" />

        {active > 0 && (
          <Link
            href="/jobs"
            className="rounded-subtle px-compact py-tight text-small text-content-secondary underline underline-offset-2 transition-colors hover:bg-surface-hover hover:text-content-primary"
          >
            Clear {active} filter{active === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      {/*
        `relative w-fit` so the closed state is exactly the width of its button.
        The open panel is absolutely positioned, so it overlays rather than
        stretching the summary to match — a <details> whose content is in flow
        forces the whole element to the width of the widest child, which is what
        made the collapsed button span the page.
      */}
      <details open={filters.panelOpen} className="relative w-fit">
        <summary className="flex w-fit list-none items-center gap-tight rounded-subtle border border-border-subtle bg-surface-base px-default py-compact text-small font-medium text-content-primary transition-colors hover:bg-surface-hover">
          <svg
            aria-hidden="true"
            viewBox="0 0 14 14"
            className="size-icon-sm shrink-0 text-content-secondary"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <path d="M1.5 3h11M3.5 7h7M6 11h2" />
          </svg>
          Filters
          {active > 0 && (
            <span className="rounded-tag bg-accent-default px-tight py-hairline text-caption tabular-nums text-content-inverse">
              {active}
            </span>
          )}
          <Chevron open={filters.panelOpen} />
        </summary>

        <form
          method="get"
          action="/jobs"
          className="filter-panel absolute left-0 top-full z-10 mt-tight flex flex-col gap-body rounded-default border border-border-subtle bg-surface-base p-default shadow-overlay"
        >
          <input type="hidden" name="panel" value="1" />
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.searchDescriptions && <input type="hidden" name="desc" value="1" />}
          {filters.recency && (
            <input type="hidden" name="recency" value={filters.recency} />
          )}

          <div className="grid grid-cols-1 gap-body sm:grid-cols-2 sm:grid-cols-2">
            <Section title="Experience">
              <Choice type="radio" name="years" value="" checked={!filters.years} label="Any" count={facets.total?.all} />
              {YEARS_BUCKETS.map((b) => (
                <Choice key={b.key} type="radio" name="years" value={b.key} checked={filters.years === b.key} label={b.label} count={facets.years?.[b.key]} />
              ))}
              <input type="hidden" name="yrsunk" value="0" />
              <Choice type="checkbox" name="yrsunk" value="1" checked={filters.includeYearsUnknown} label="Include unstated" count={facets.years?.unstated} />
            </Section>

            <Section title="Pay">
              <Choice type="radio" name="comp" value="" checked={!filters.comp} label="Any" count={facets.total?.all} />
              {COMP_BUCKETS.map((b) => (
                <Choice key={b.key} type="radio" name="comp" value={b.key} checked={filters.comp === b.key} label={b.label} count={facets.comp?.[b.key]} />
              ))}
              <input type="hidden" name="compunk" value="0" />
              <Choice type="checkbox" name="compunk" value="1" checked={filters.includeCompUnknown} label="Include unlisted" count={facets.comp?.unlisted} />
            </Section>

            <Section title="Workplace">
              {REMOTE_OPTIONS.map((o) => (
                <Choice key={o.key} type="checkbox" name="remote" value={o.key} checked={filters.remote.includes(o.key)} label={o.label} count={facets.remote?.[o.key]} />
              ))}
              {/*
                US-only is the default, shown as an explicit opt-out rather than
                applied invisibly. 762 of 2,380 open postings are elsewhere, and
                a quarter of the feed vanishing with nothing on screen to explain
                it reads as a bug rather than a setting.
              */}
              <input type="hidden" name="intl" value="0" />
              <Choice type="checkbox" name="intl" value="1" checked={!filters.usOnly} label="Include non-US roles" />
            </Section>

            <Section title="City">
              <div className="flex max-h-52 flex-col gap-hair overflow-y-auto">
                {cities.length === 0 ? (
                  <p className="px-tight text-caption text-content-tertiary">
                    No cities in this result set.
                  </p>
                ) : (
                  cities.map((c) => (
                    <Choice key={c.name} type="checkbox" name="city" value={c.name} checked={filters.cities.includes(c.name)} label={c.name} count={c.n} />
                  ))
                )}
              </div>
            </Section>
          </div>

          <div className="flex items-center justify-between gap-snug border-t border-border-subtle pt-default">
            <Link
              href="/jobs?panel=1"
              className="rounded-subtle px-compact py-tight text-small text-content-secondary underline underline-offset-2 transition-colors hover:bg-surface-hover hover:text-content-primary"
            >
              Clear all
            </Link>
            <button
              type="submit"
              className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
            >
              Show {total.toLocaleString()} {total === 1 ? "role" : "roles"}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
