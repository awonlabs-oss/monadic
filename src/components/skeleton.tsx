/**
 * The shape of a page while its data is in flight.
 *
 * These exist because /for-you spends about 1.2 seconds inside recommend_jobs,
 * scoring thousands of postings against your criteria, and until now the
 * browser showed the previous page for all of it. Next.js will not paint a
 * navigation that has no loading boundary — so the click registered, nothing
 * moved, and the app looked stuck at precisely the moment it was working
 * hardest.
 *
 * A boundary changes what the wait looks like, not how long it is. The shell,
 * the sidebar and the heading paint immediately; only the list streams in. It
 * also makes the router prefetch useful: with a boundary to render, hovering a
 * nav link warms the route instead of waiting for the whole payload.
 *
 * Deliberately not animated. A pulsing block draws the eye to the one part of
 * the screen with nothing to read yet, and at roughly a second it flashes
 * rather than reassures. These are quiet placeholders holding the right shape,
 * so nothing jumps when the real rows arrive.
 */

function Line({ className = "" }: { className?: string }) {
  return <span className={`block rounded-tag bg-surface-sunken ${className}`} />;
}

/** One feed card: tile, three text rows, two buttons. Matches JobCard. */
export function JobCardSkeleton() {
  return (
    <div className="flex items-start gap-body rounded-default border border-border-subtle bg-surface-base px-default py-body">
      <Line className="size-logo-card shrink-0 rounded-preview" />
      <div className="flex min-w-0 flex-1 flex-col gap-row">
        <Line className="h-3 w-32" />
        <Line className="h-4 w-2/3" />
        <span className="flex gap-tight pt-micro">
          <Line className="h-4 w-20" />
          <Line className="h-4 w-24" />
          <Line className="h-4 w-16" />
        </span>
      </div>
      <span className="flex shrink-0 gap-compact">
        <Line className="h-7 w-16" />
        <Line className="h-7 w-16" />
      </span>
    </div>
  );
}

export function JobListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-compact">
      {Array.from({ length: rows }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** The heading block both feeds carry, so the top of the page does not move. */
export function PageHeadingSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-tight">
      <Line className="h-8 w-48" />
      <Line className="h-4 w-64" />
    </div>
  );
}

/** Announced once, for anyone who cannot see the placeholders. */
export function LoadingAnnouncement({ what }: { what: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      Loading {what}…
    </p>
  );
}
