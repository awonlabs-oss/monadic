import Link from "next/link";
import type { JobListItem } from "@/lib/data/jobs";
import { formatComp, formatYears, postedLabel } from "@/lib/format";
import { CompanyLogo } from "./company-logo";
import { SaveButton } from "./save-button";
import { SendIcon } from "./icons";

/**
 * JobCard — the feed card. Figma component `JobCardWide`, node 12:140.
 *
 * Layout is Body (preview tile + detail column), then a full-width divider,
 * then a full-width footer. The divider and footer are siblings of Body rather
 * than children of the detail column, so both run the whole width of the card
 * and are not indented past the tile.
 *
 * Buttons and tags are rounded rectangles now, not pills — radius/subtle (6px)
 * for buttons, radius/tag (4px) for tags, radius/default (10px) for the card
 * itself, down from 18px.
 *
 * Absence is designed, not defaulted. 59% of these postings state no pay and
 * 30% no years, so both render copy in the slot a value would occupy rather
 * than collapsing the row (DESIGN.md §7).
 */

function Tag({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li
      className={`rounded-tag px-chip py-xtight text-caption font-medium leading-none ${
        muted
          ? "bg-surface-base text-content-tertiary ring-1 ring-border-subtle ring-inset"
          : "bg-accent-muted text-content-secondary"
      }`}
    >
      {children}
    </li>
  );
}

/** Human labels for the criteria keys recommend_jobs returns. */
const CRITERION_LABELS: Record<string, string> = {
  role: "role",
  years: "experience",
  comp: "pay",
  city: "location",
  remote: "workplace",
};

export function JobCard({
  job,
  match,
}: {
  job: JobListItem;
  /** Present only in the recommendation feed. */
  match?: { matched: number; applicable: number; keys: string[] } | null;
}) {
  // Either write means it is saved. Save performs both, but a job tracked
  // before they were merged has only the application row.
  const saved =
    job.interaction_state === "saved" || job.application_id !== null;
  const comp = formatComp(job);
  const years = formatYears(job);
  const posted = postedLabel(job.posted_at, job.first_seen_at);

  // Real locations are frequently multi-valued and long
  // ("New York City, NY; San Francisco, CA | New York City, NY"), so the tag
  // shows the first and keeps the whole string in the title attribute rather
  // than truncating it away.
  const primaryLocation = job.location_raw?.split(/[;|]/)[0]?.trim() || null;
  const remoteLabel =
    job.remote_policy === "remote"
      ? "Remote"
      : job.remote_policy === "hybrid"
        ? "Hybrid"
        : job.remote_policy === "onsite"
          ? "On-site"
          : null;
  const locationTag = [primaryLocation, remoteLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    // No h-full and no growing body. Both existed to equalise card heights
    // across a two-column grid; the feed is one column now (frame 22:471), so
    // all they did was stretch every card to the tallest one on the page and
    // push the divider away from the content it separates. That stretch was
    // the dead space.
    // `relative` plus the stretched link on the title below: the whole card is
    // one click target without nesting anything inside an anchor, which would be
    // invalid markup and would swallow the Save and Track buttons.
    <article className="relative flex flex-col gap-snug rounded-default border border-border-subtle bg-surface-base px-default pt-default pb-body transition-colors hover:border-border-default">
      <div className="flex items-start gap-body">
        <CompanyLogo name={job.company_name} src={job.company_logo_url} />

        {/*
          Save is a sibling of this column, not a row inside it.

          Inside it, the button set the height of the line it shared with the
          company name: a 23px control wrapping an 12px label, so the name was
          centred in a box half again its own height and sat a good 6px below
          the top of the logo beside it, with the same 6px opening up again
          between it and the title. Hoisting the button out leaves the column as
          three text rows one gap apart, and its first line now starts where the
          logo does.
        */}
        <div className="flex min-w-0 flex-1 flex-col gap-row">
          <p className="flex min-w-0 items-center gap-row text-small leading-none">
            <span className="truncate font-medium text-content-secondary">
              {job.company_name}
            </span>
            <span
              aria-hidden="true"
              className="size-hair shrink-0 rounded-full bg-content-tertiary"
            />
            <span className="shrink-0 text-content-tertiary">
              {posted.verb} {posted.date}{" "}
              <span className="text-content-tertiary/80">
                [{posted.elapsed}]
              </span>
            </span>
          </p>

          {/*
            The title links to the detail page, not to the posting. Applying
            happens there, behind an Apply button that says where it goes; a card
            title that silently threw you onto a third-party board was the wrong
            default.

            after:absolute after:inset-0 is what makes the card clickable — the
            anchor's own box stays around the text, so the accessible name is the
            title rather than the whole card read aloud.
          */}
          <h3 className="text-lead font-semibold leading-default tracking-snug text-content-primary">
            <Link
              href={`/jobs/${job.id}`}
              className="after:absolute after:inset-0 after:rounded-default hover:underline hover:underline-offset-2"
            >
              {job.title}
            </Link>
          </h3>

          <ul className="flex flex-wrap items-start gap-tight">
            {job.employment_type && <Tag>{job.employment_type}</Tag>}
            {/*
              Years renders even when unknown. DESIGN.md §7: an absent tag would
              imply the field was checked and did not apply.
            */}
            {years.known ? (
              <Tag>{years.value}</Tag>
            ) : (
              <Tag muted>Yrs not stated</Tag>
            )}
            {locationTag ? (
              <Tag>
                <span title={job.location_raw ?? undefined}>{locationTag}</span>
              </Tag>
            ) : (
              <Tag muted>Location not stated</Tag>
            )}
          </ul>

          {/*
            Why this job is here, in the feed that put it here. A score would be
            unarguable; naming the criteria means you can see when the ranking is
            wrong and go fix the criteria rather than distrust the feed.

            `applicable` rather than the number of criteria you set: a posting
            that states no pay makes pay uncheckable, and counting it in the
            denominator would read as a failure to match rather than a silence.
          */}
          {match && match.applicable > 0 && (
            <p className="text-caption leading-none text-content-tertiary">
              <span className="font-medium text-signal-default">
                Matches {match.matched} of {match.applicable}
              </span>
              {match.keys.length > 0 && (
                <>
                  {" · "}
                  {match.keys.map((k) => CRITERION_LABELS[k] ?? k).join(", ")}
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div aria-hidden="true" className="h-px w-full bg-border-subtle" />

      <div className="flex items-center justify-between gap-snug">
        <div className="flex min-w-0 flex-col gap-hair leading-none">
          {comp.known ? (
            <p className="text-figure font-semibold tracking-snug tabular-nums text-content-primary">
              {comp.value}
            </p>
          ) : (
            <p className="text-body text-content-tertiary">Comp not listed</p>
          )}
          {/*
            The frame's second line reads "Series B · 60 people". Company stage
            and headcount are returned by no ATS and are not columns on the
            companies table, so the slot carries the compensation's provenance
            when there is something to qualify, and is otherwise absent rather
            than padded with filler.
          */}
          {comp.known && comp.caveat && (
            <p className="truncate text-caption text-content-tertiary">
              Parsed from description
            </p>
          )}
        </div>

        {/*
          Save and Apply, together, because they are the two things you do with
          a posting. Save was previously a bookmark in the top-right corner and
          Track a separate button down here; one of them putting the job on the
          board and the other not was a distinction that had to be explained.

          z-10 keeps both above the title's stretched overlay.
        */}
        <div className="relative z-10 flex shrink-0 items-center gap-compact">
          <SaveButton
            jobId={job.id}
            jobTitle={job.title}
            companyName={job.company_name}
            saved={saved}
          />

          {/*
            Applying leaves the app, so the link says where it goes rather than
            relying on the icon alone. A posting that arrived without a URL has
            nothing to link to and says so.
          */}
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-tight rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
            >
              <SendIcon className="size-icon-sm shrink-0" />
              Apply
              <span className="sr-only">
                {" "}
                to {job.title} at {job.company_name} on their site, opens in a
                new tab
              </span>
            </a>
          ) : (
            <span className="rounded-subtle border border-border-subtle bg-surface-sunken px-default py-compact text-small leading-none text-content-tertiary">
              No link
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
