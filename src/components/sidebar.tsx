"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IngestionHealth } from "@/lib/data/health";
import { relativeShort } from "@/lib/format";

/**
 * The application shell's left rail. DESIGN.md section 4, DECIDED.
 *
 * Fixed 248px, canvas-colored with a 1px right border, never collapses at
 * desktop widths. Order is fixed: wordmark, primary nav, saved views, spacer,
 * ingestion health.
 *
 * The active state is a white raised pill rather than a color change, per the
 * component inventory — which also satisfies section 9's rule that color never
 * carries meaning alone, since the pill is a shape difference and aria-current
 * carries it for assistive tech.
 */

const NAV = [
  { href: "/jobs", label: "New jobs", badge: "newJobs" as const },
  { href: "/applications", label: "Tracked", badge: "tracked" as const },
  { href: "/contacts", label: "Contacts", badge: null },
  { href: "/templates", label: "Templates", badge: null },
  { href: "/profile", label: "Profile", badge: null },
];

function Badge({ count }: { count: number }) {
  return (
    <span className="bg-surface-sunken text-content-secondary text-caption font-medium rounded-full px-tight py-hair leading-none">
      {count}
    </span>
  );
}

function NavRow({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number | null;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center justify-between rounded-default px-compact h-9 text-body ${
          active
            ? "bg-surface-base text-content-primary font-medium shadow-raised"
            : "text-content-secondary"
        }`}
      >
        <span>{label}</span>
        {count !== null && count > 0 && <Badge count={count} />}
      </Link>
    </li>
  );
}

export function Sidebar({
  health,
  counts,
  savedActive = false,
}: {
  health: IngestionHealth;
  counts: { newJobs: number; tracked: number; saved: number };
  savedActive?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-comfortable px-comfortable py-loose">
      <Link href="/jobs" className="flex items-center gap-compact px-compact">
        <span
          aria-hidden="true"
          className="size-dot rounded-full bg-content-primary"
        />
        <span className="text-lead font-semibold tracking-tight text-content-primary">
          monadic
        </span>
      </Link>

      <nav aria-label="Main">
        <ul className="flex flex-col gap-micro">
          {NAV.map((item) => (
            <NavRow
              key={item.href}
              href={item.href}
              label={item.label}
              count={item.badge ? counts[item.badge] : null}
              active={
                pathname === item.href || pathname.startsWith(`${item.href}/`)
              }
            />
          ))}
        </ul>
      </nav>

      {/*
        DESIGN.md §4 places Saved Views here. There is no saved_views table and
        user-defined views are not in Phase 1, but "jobs I bookmarked" is a real
        view backed by real data, and it is where feed bookmarks live now that
        Save no longer puts anything on the pipeline board.
      */}
      {/*
        Labelled <nav>, not a heading. An <h2> here sits before the page's <h1>
        in document order, so a screen reader user tabbing through headings meets
        "Saved views" before they meet the name of the page they are on. The
        landmark label carries the same information without disturbing the
        document outline.
      */}
      <nav aria-label="Saved views" className="flex flex-col gap-micro">
        <p
          aria-hidden="true"
          className="px-compact pb-tight text-caption font-medium uppercase text-content-tertiary"
        >
          Saved views
        </p>
        <ul className="flex flex-col gap-micro">
          <NavRow
            href="/jobs?saved=1"
            label="Saved jobs"
            count={counts.saved}
            active={pathname === "/jobs" && savedActive}
          />
        </ul>
      </nav>

      <div className="flex-1" />

      <section
        aria-label="Ingestion health"
        className="rounded-default bg-surface-sunken px-default py-compact flex flex-col gap-tight"
      >
        <p className="flex items-center gap-compact text-caption text-content-secondary">
          <span
            aria-hidden="true"
            className={`size-tight rounded-full ${
              health.failed > 0 ? "bg-status-stale" : "bg-signal-default"
            }`}
          />
          {health.lastSyncAt
            ? `Last sync ${relativeShort(health.lastSyncAt)}`
            : "Never synced"}
        </p>
        <p className="text-caption text-content-tertiary">
          {health.boards} boards · {health.failed} failed
        </p>
      </section>
    </div>
  );
}
