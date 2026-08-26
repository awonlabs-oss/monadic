import Link from "next/link";
import { listApplications } from "@/lib/data/applications";
import { COLUMNS, needsAction, isClosed } from "@/lib/applications/pipeline";
import { ApplicationCard } from "@/components/application-card";

/*
 * /applications — the pipeline board. Figma frame "Screen / Tracked board".
 *
 * Four columns over eight statuses: "In process" absorbs the three interview
 * stages, because the board answers "where does this stand", and the difference
 * between a recruiter screen and an onsite is a detail of that answer, carried
 * on the card rather than by a column each.
 *
 * Rejected and withdrawn stay off the board behind a toggle. Over a real job
 * search they become the majority, and a board whose fastest-growing column is
 * the one you least want to look at stops being useful. Nothing is deleted —
 * the timeline keeps every one, which is what stage-duration analysis needs
 * later.
 *
 * The Board/List toggle in the frame has no List mockup, so List is present but
 * disabled rather than invented.
 */

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showClosed =
    (Array.isArray(params.closed) ? params.closed[0] : params.closed) === "1";

  const { applications, closedCount } = await listApplications({
    includeClosed: showClosed,
  });

  const live = applications.filter((a) => !isClosed(a.status));
  const closed = applications.filter((a) => isClosed(a.status));
  const needing = live.filter((a) => needsAction(a).needed).length;

  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <header className="flex flex-wrap items-start justify-between gap-snug">
        <div className="flex flex-col gap-tight">
          <h1 className="text-title font-semibold tracking-tight text-content-primary">
            Tracked
          </h1>
          <p className="text-body text-content-secondary">
            {live.length === 0
              ? "Nothing tracked yet."
              : `${live.length} active · ${needing} ${
                  needing === 1 ? "needs" : "need"
                } a next action`}
          </p>
        </div>

        <div
          role="group"
          aria-label="View"
          className="flex items-center gap-hair rounded-subtle bg-surface-sunken p-hair"
        >
          <span className="rounded-subtle bg-surface-base px-compact py-tight text-small font-medium text-content-primary">
            Board
          </span>
          {/* No List frame exists in Figma; disabled rather than invented. */}
          <span
            aria-disabled="true"
            title="List view is not designed yet"
            className="px-compact py-tight text-small font-medium text-content-tertiary"
          >
            List
          </span>
        </div>
      </header>

      {live.length === 0 && closed.length === 0 ? (
        <p className="text-body text-content-secondary">
          Nothing saved yet. Press <strong>Save</strong> on a job in{" "}
          <Link href="/jobs" className="underline underline-offset-2">
            For You
          </Link>{" "}
          to start one here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-default md:grid-cols-2 min-[1100px]:grid-cols-4">
          {COLUMNS.map((column) => {
            const cards = live.filter((a) =>
              (column.statuses as string[]).includes(a.status),
            );
            return (
              <section
                key={column.key}
                aria-labelledby={`col-${column.key}`}
                className="flex flex-col gap-compact"
              >
                <h2
                  id={`col-${column.key}`}
                  className="flex items-center gap-tight px-tight text-small font-medium text-content-primary"
                >
                  {column.label}
                  <span className="tabular-nums text-content-tertiary">
                    {cards.length}
                  </span>
                </h2>

                {cards.length === 0 ? (
                  <p className="rounded-card border border-dashed border-border-default px-card-x py-loose text-center text-caption text-content-tertiary">
                    {column.emptyCopy}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-compact">
                    {cards.map((app) => (
                      <li key={app.id}>
                        <ApplicationCard app={app} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {closedCount > 0 && (
        <section
          aria-labelledby="closed-heading"
          className="flex flex-col gap-compact border-t border-border-subtle pt-default"
        >
          <h2 id="closed-heading" className="text-small font-medium text-content-primary">
            Closed
            <span className="pl-tight tabular-nums text-content-tertiary">
              {closedCount}
            </span>
          </h2>
          {showClosed ? (
            <>
              <Link
                href="/applications"
                className="w-fit text-small text-content-secondary underline underline-offset-2"
              >
                Hide closed
              </Link>
              <ul className="grid grid-cols-1 gap-compact md:grid-cols-2 min-[1100px]:grid-cols-4">
                {closed.map((app) => (
                  <li key={app.id}>
                    <ApplicationCard app={app} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Link
              href="/applications?closed=1"
              className="w-fit text-small text-content-secondary underline underline-offset-2"
            >
              Show {closedCount} closed{" "}
              {closedCount === 1 ? "application" : "applications"}
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
