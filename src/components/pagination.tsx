import Link from "next/link";
import { hrefFor, type JobFilters } from "@/lib/filters";

/**
 * Page controls for the feed.
 *
 * Offset paging rather than a cursor: the feed is sortable by pay and by two
 * different dates, and a cursor would have to encode whichever sort is active.
 * At a few thousand rows the offset cost is nothing, and it buys direct links
 * to any page.
 *
 * The window is elided rather than rendering 50 page links, and first and last
 * are always reachable so the end of a result set is one click away.
 */

function pageWindow(current: number, last: number): Array<number | "gap"> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages = new Set<number>([1, last, current]);
  for (const p of [current - 1, current + 1]) {
    if (p > 1 && p < last) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

export function Pagination({
  filters,
  total,
  pageSize,
}: {
  filters: JobFilters;
  total: number;
  pageSize: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const current = Math.min(filters.page, lastPage);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  const linkClass =
    "rounded-subtle border border-border-subtle bg-surface-base px-compact py-tight text-small font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary";
  const disabledClass =
    "rounded-subtle border border-border-subtle px-compact py-tight text-small font-medium text-content-tertiary/60";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-snug border-t border-border-subtle pt-default"
    >
      <p className="text-caption text-content-tertiary tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of{" "}
        {total.toLocaleString()}
      </p>

      <ul className="flex flex-wrap items-center gap-tight">
        <li>
          {current > 1 ? (
            <Link
              href={hrefFor(filters, { page: current - 1 })}
              className={linkClass}
              rel="prev"
            >
              Previous
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled="true">
              Previous
            </span>
          )}
        </li>

        {pageWindow(current, lastPage).map((entry, i) =>
          entry === "gap" ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              className="px-tight text-caption text-content-tertiary"
            >
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={hrefFor(filters, { page: entry })}
                aria-current={entry === current ? "page" : undefined}
                aria-label={`Page ${entry}`}
                className={
                  entry === current
                    ? "rounded-subtle bg-accent-default px-compact py-tight text-small font-medium tabular-nums text-content-inverse"
                    : `${linkClass} tabular-nums`
                }
              >
                {entry}
              </Link>
            </li>
          ),
        )}

        <li>
          {current < lastPage ? (
            <Link
              href={hrefFor(filters, { page: current + 1 })}
              className={linkClass}
              rel="next"
            >
              Next
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled="true">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
