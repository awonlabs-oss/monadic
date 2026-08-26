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
import { FilterDisclosure } from "./filter-disclosure";

/**
 * Filter controls: one row of recency windows and a disclosure holding the rest.
 *
 * Recency sits outside the panel because it is reached for most often and
 * should cost one click. The three windows select a subset rather than reorder
 * one, so they are filters — the feed always orders newest posted first
 * underneath. They share a line with the Filters button because they are the
 * same kind of control; on separate lines they read as two toolbars.
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-hair">
      <legend className="pb-tight text-caption font-medium uppercase text-content-tertiary">
        {title}
      </legend>
      {children}
    </fieldset>
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
    // One row, not two. The recency windows and the Filters disclosure are the
    // same kind of control and belong on the same line (frame 22:471); stacking
    // them read as two unrelated toolbars.
    //
    // `relative` here rather than on the <details>: the popover is anchored to
    // the row, so it opens at the left edge of the feed column instead of
    // wherever the Filters button happens to have landed after three pills.
    <div className="relative flex flex-wrap items-center gap-tight">
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

      {/*
        The disclosure is a client component: its submit button counts live as
        boxes are ticked, and clicking away from an open panel applies what was
        ticked rather than discarding it. The sections below stay server
        components and are handed to it as children.
      */}
      <FilterDisclosure
        active={active}
        defaultOpen={filters.panelOpen}
        serverTotal={total}
        hidden={[
          ...(filters.q ? [{ name: "q", value: filters.q }] : []),
          ...(filters.searchDescriptions ? [{ name: "desc", value: "1" }] : []),
          ...(filters.recency
            ? [{ name: "recency", value: filters.recency }]
            : []),
        ]}
      >
        <div className="grid grid-cols-1 gap-body sm:grid-cols-2 sm:grid-cols-2">
          <Section title="Experience">
            <Choice
              type="radio"
              name="years"
              value=""
              checked={!filters.years}
              label="Any"
              count={facets.total?.all}
            />
            {YEARS_BUCKETS.map((b) => (
              <Choice
                key={b.key}
                type="radio"
                name="years"
                value={b.key}
                checked={filters.years === b.key}
                label={b.label}
                count={facets.years?.[b.key]}
              />
            ))}
            <input type="hidden" name="yrsunk" value="0" />
            <Choice
              type="checkbox"
              name="yrsunk"
              value="1"
              checked={filters.includeYearsUnknown}
              label="Include unstated"
              count={facets.years?.unstated}
            />
          </Section>

          <Section title="Pay">
            <Choice
              type="radio"
              name="comp"
              value=""
              checked={!filters.comp}
              label="Any"
              count={facets.total?.all}
            />
            {COMP_BUCKETS.map((b) => (
              <Choice
                key={b.key}
                type="radio"
                name="comp"
                value={b.key}
                checked={filters.comp === b.key}
                label={b.label}
                count={facets.comp?.[b.key]}
              />
            ))}
            <input type="hidden" name="compunk" value="0" />
            <Choice
              type="checkbox"
              name="compunk"
              value="1"
              checked={filters.includeCompUnknown}
              label="Include unlisted"
              count={facets.comp?.unlisted}
            />
          </Section>

          <Section title="Workplace">
            {REMOTE_OPTIONS.map((o) => (
              <Choice
                key={o.key}
                type="checkbox"
                name="remote"
                value={o.key}
                checked={filters.remote.includes(o.key)}
                label={o.label}
                count={facets.remote?.[o.key]}
              />
            ))}
            {/*
                  US-only is the default, shown as an explicit opt-out rather than
                  applied invisibly. 762 of 2,380 open postings are elsewhere, and
                  a quarter of the feed vanishing with nothing on screen to explain
                  it reads as a bug rather than a setting.
                */}
            <input type="hidden" name="intl" value="0" />
            <Choice
              type="checkbox"
              name="intl"
              value="1"
              checked={!filters.usOnly}
              label="Include non-US roles"
            />
          </Section>

          <Section title="City">
            <div className="flex max-h-52 flex-col gap-hair overflow-y-auto">
              {cities.length === 0 ? (
                <p className="px-tight text-caption text-content-tertiary">
                  No cities in this result set.
                </p>
              ) : (
                cities.map((c) => (
                  <Choice
                    key={c.name}
                    type="checkbox"
                    name="city"
                    value={c.name}
                    checked={filters.cities.includes(c.name)}
                    label={c.name}
                    count={c.n}
                  />
                ))
              )}
            </div>
          </Section>
        </div>
      </FilterDisclosure>

      {/*
        The frame puts a sort control at the right end of this row. There is one
        ordering — newest posted first — so there is nothing to choose between,
        and the slot carries the only thing that belongs at that end: the escape
        hatch out of whatever is currently applied.
      */}
      <span className="flex-1" />

      {active > 0 && (
        <Link
          href="/jobs?reset=1"
          className="rounded-subtle px-compact py-tight text-small text-content-secondary underline underline-offset-2 transition-colors hover:bg-surface-hover hover:text-content-primary"
        >
          Clear {active} filter{active === 1 ? "" : "s"}
        </Link>
      )}
    </div>
  );
}
