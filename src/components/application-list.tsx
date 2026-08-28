import Link from "next/link";
import type { ApplicationRow } from "@/lib/data/applications";
import { hasApplied, needsAction, type Status } from "@/lib/applications/pipeline";
import { relativeShort } from "@/lib/format";
import { CompanyLogo } from "./company-logo";
import { StatusBadge } from "./status-badge";
import { StatusPicker } from "./status-picker";
import { DeleteApplication } from "./delete-application";

/**
 * Tracked, as a list. Figma frame `Screen / Tracked list`, node 14:207.
 *
 * The board answers "where does everything stand"; this answers "what is
 * happening, in order". Both read the same rows — the difference is that a
 * table can carry a column of next actions and a column of last activity side
 * by side, which is what makes progress legible, and a column of cards cannot.
 *
 * Rows are ordered by attention rather than by stage: anything asking for
 * something rises to the top, then the rest by how recently they moved. A list
 * sorted by pipeline stage would bury the one thing that has gone quiet behind
 * six that are fine.
 *
 * The frame's CONTACTS column is not built. The contacts table is empty and
 * there is no way to add one yet, so every row would read "None" — a column of
 * nothing, occupying the width of something.
 */

function Cell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-compact py-snug align-middle ${className}`}>
      {children}
    </td>
  );
}

function Head({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-compact pb-tight pt-compact text-left text-micro font-medium uppercase tracking-wide text-content-tertiary ${className}`}
    >
      {children}
    </th>
  );
}

export function ApplicationList({
  applications,
}: {
  applications: ApplicationRow[];
}) {
  const rows = applications
    .map((app) => ({ app, attention: needsAction(app) }))
    .sort((a, b) => {
      if (a.attention.needed !== b.attention.needed)
        return a.attention.needed ? -1 : 1;
      const at = a.app.last_event_at ?? a.app.status_changed_at;
      const bt = b.app.last_event_at ?? b.app.status_changed_at;
      return bt.localeCompare(at);
    });

  return (
    <div className="overflow-x-auto rounded-default border border-border-subtle bg-surface-base">
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="border-b border-border-subtle">
            <Head>Role</Head>
            <Head>Status</Head>
            <Head>Next action</Head>
            <Head>Last activity</Head>
            <th scope="col" className="w-0" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ app, attention }) => (
            <tr
              key={app.id}
              className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-canvas"
            >
              <Cell>
                <div className="flex items-center gap-compact">
                  <CompanyLogo
                    name={app.company_name}
                    src={app.company_logo_url}
                    size="small"
                  />
                  <div className="flex min-w-0 flex-col gap-hair">
                    <Link
                      href={`/jobs/${app.job_id}`}
                      className="truncate text-body font-medium leading-tight text-content-primary hover:underline hover:underline-offset-2"
                    >
                      {app.job_title}
                    </Link>
                    <span className="truncate text-caption leading-tight text-content-tertiary">
                      {app.company_name}
                      {app.job_closed_at && (
                        <span className="text-badge-amber-fg">
                          {" "}
                          · posting closed
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </Cell>

              {/*
                The status cell is the control, not a label beside one. Changing
                where something stands is the thing you come to this table to do,
                and a badge you have to open a menu next to is a click of
                ceremony around it.
              */}
              <Cell className="w-48">
                <StatusPicker applicationId={app.id} status={app.status} />
              </Cell>

              <Cell className="max-w-reading">
                {attention.needed ? (
                  <span className="text-body font-medium text-badge-amber-fg">
                    {attention.reason}
                  </span>
                ) : app.next_action ? (
                  <span className="text-body text-content-secondary">
                    {app.next_action}
                    {app.next_action_at && (
                      <span className="text-content-tertiary">
                        {" · "}
                        {new Date(app.next_action_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-body text-content-tertiary">—</span>
                )}
              </Cell>

              <Cell>
                <span className="whitespace-nowrap text-body tabular-nums text-content-tertiary">
                  {relativeShort(app.last_event_at ?? app.status_changed_at)}
                </span>
              </Cell>

              <Cell className="text-right">
                <span className="inline-flex items-center gap-compact">
                  {/*
                    The frame's CONTACTS column, arrived at from the other side.
                    A column would have shown a count per row and cost the width
                    of one; a link goes to the place the count would have made
                    you go anyway, and only appears once there is outreach to do.
                  */}
                  {hasApplied(app) && (
                    <Link
                      href={`/applications/${app.id}`}
                      className="whitespace-nowrap text-caption font-medium text-content-secondary underline underline-offset-2 transition-colors hover:text-content-primary"
                    >
                      Outreach
                      <span className="sr-only">
                        {" "}
                        for {app.job_title} at {app.company_name}
                      </span>
                    </Link>
                  )}
                  <DeleteApplication
                    applicationId={app.id}
                    title={app.job_title}
                    companyName={app.company_name}
                  />
                <Link
                  href={`/jobs/${app.job_id}`}
                  aria-label={`Open ${app.job_title} at ${app.company_name}`}
                  className="inline-flex rounded-subtle p-tight text-content-tertiary transition-colors hover:bg-surface-hover hover:text-content-primary"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="size-icon-xs"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 2.5 8 6l-3.5 3.5" />
                  </svg>
                </Link>
                </span>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The banner above the table. Names the applications that have gone quiet
 * rather than counting them, because "2 need attention" makes you go looking
 * and the names are what you were going to look for.
 */
export function QuietBanner({
  applications,
}: {
  applications: ApplicationRow[];
}) {
  const quiet = applications
    .map((app) => ({ app, attention: needsAction(app) }))
    .filter((r) => r.attention.needed);

  if (quiet.length === 0) return null;

  const named = quiet
    .slice(0, 2)
    .map((r) => `${r.app.company_name} (${r.attention.reason?.toLowerCase()})`)
    .join(" and ");

  return (
    <div className="flex flex-wrap items-center justify-between gap-snug rounded-default bg-badge-amber-bg px-default py-compact">
      <p className="flex items-center gap-chip text-body text-badge-amber-fg">
        <StatusBadge
          status="needs_action"
          label={`${quiet.length} need attention`}
        />
        <span>
          {named}
          {quiet.length > 2 && ` and ${quiet.length - 2} more`}
        </span>
      </p>
    </div>
  );
}

/** The four board statuses a row can sit in, for the summary line. */
export function statusSummary(applications: ApplicationRow[]): string {
  const counts = new Map<string, number>();
  for (const app of applications) {
    counts.set(app.status, (counts.get(app.status) ?? 0) + 1);
  }
  return [...counts]
    .map(([status, n]) => `${n} ${(status as Status).replace(/_/g, " ")}`)
    .join(" · ");
}
