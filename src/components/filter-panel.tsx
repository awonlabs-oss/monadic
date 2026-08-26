import Link from "next/link";
import {
  COMP_BUCKETS,
  REMOTE_OPTIONS,
  SORTS,
  YEARS_BUCKETS,
  activeCount,
  hrefFor,
  type JobFilters,
} from "@/lib/filters";
import type { Facets } from "@/lib/data/jobs";

/**
 * The filter panel.
 *
 * Replaces a row of eighteen loose pills, which showed every option at equal
 * weight, gave no sense of what any of them would yield, and navigated on every
 * single click.
 *
 * Three things drive the structure, following the reference patterns supplied:
 *
 *  1. One entry point carrying a count, not a wall of controls. The panel is a
 *     native <details> disclosure — accessible and keyboard-operable with no
 *     JavaScript, and not a hand-rolled dropdown, which DESIGN.md §9 forbids.
 *     Its open state rides in the URL so it survives the round trip.
 *
 *  2. Every option shows how many roles it would return, computed with the
 *     other dimensions already applied. Choosing "Remote" reprices the pay
 *     counts. An option that would yield nothing is visibly zero before it is
 *     clicked rather than after.
 *
 *  3. One submit, not a navigation per toggle. It is a plain GET form, so
 *     several choices are made and applied together, and the result is still an
 *     ordinary shareable URL.
 *
 * The include-unknown checkboxes are prominent on purpose. 59% of these
 * postings state no pay and 30% no years — hiding them is a big decision, and
 * making it silently would look like ingestion had lost half the feed.
 */

function Count({ n }: { n: number | undefined }) {
  return (
    <span className={`ml-auto text-caption tabular-nums ${n ? "text-content-tertiary" : "text-content-tertiary/60"}`}>
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
    <label className="flex cursor-pointer items-center gap-tight rounded-tag px-tight py-xtight text-body text-content-primary hover:bg-surface-sunken">
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
      <legend className="pb-tight text-caption font-medium uppercase tracking-none text-content-tertiary">
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
}: {
  filters: JobFilters;
  facets: Facets;
  total: number;
}) {
  const active = activeCount(filters);

  return (
    <div className="flex flex-wrap items-start justify-between gap-snug">
      <details
        open={filters.panelOpen}
        className="min-w-0 rounded-default border border-border-subtle bg-surface-base"
      >
        <summary className="flex cursor-pointer list-none items-center gap-tight px-default py-compact text-small font-medium text-content-primary">
          Filters
          {active > 0 && (
            <span className="rounded-tag bg-accent-default px-tight py-hairline text-caption tabular-nums text-content-inverse">
              {active}
            </span>
          )}
          <span aria-hidden="true" className="text-content-tertiary">
            {filters.panelOpen ? "▲" : "▼"}
          </span>
        </summary>

        <form method="get" action="/jobs" className="flex flex-col gap-body border-t border-border-subtle p-default">
          {/* Keeps the panel open across the submit. */}
          <input type="hidden" name="panel" value="1" />
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
          {filters.searchDescriptions && <input type="hidden" name="desc" value="1" />}
          {filters.sort !== "posted" && (
            <input type="hidden" name="sort" value={filters.sort} />
          )}

          <div className="grid grid-cols-1 gap-body sm:grid-cols-3">
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
            </Section>
          </div>

          <div className="flex items-center justify-between gap-snug border-t border-border-subtle pt-default">
            <Link
              href="/jobs?panel=1"
              className="text-small text-content-secondary underline underline-offset-2"
            >
              Clear all
            </Link>
            <button
              type="submit"
              className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse"
            >
              Show {total.toLocaleString()} {total === 1 ? "role" : "roles"}
            </button>
          </div>
        </form>
      </details>

      <nav aria-label="Sort" className="flex items-center gap-tight">
        <span className="text-caption text-content-tertiary">Sort</span>
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={hrefFor(filters, { sort: s.key, page: 1 })}
            aria-current={filters.sort === s.key ? "true" : undefined}
            className={`rounded-subtle px-compact py-tight text-small font-medium ${
              filters.sort === s.key
                ? "bg-accent-default text-content-inverse"
                : "border border-border-subtle bg-surface-base text-content-secondary"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
