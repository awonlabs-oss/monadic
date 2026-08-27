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

/**
 * The `muted` variant is gone with the placeholders it existed for. It styled
 * "Yrs not stated" and "Location not stated" as present-but-empty; nothing
 * renders those now, so every tag carries a real value.
 */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-tag bg-accent-muted px-chip py-xtight text-caption font-medium leading-none text-content-secondary">
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
    // One row, and no footer.
    //
    // The card used to be a body, a full-width divider, and a footer holding
    // compensation at one end and the buttons at the other. `justify-between`
    // on a card this wide meant the footer was mostly the gap between them —
    // dead space the divider had already paid a row of height to introduce.
    //
    // Everything that row carried now sits in the row that was already there.
    // Compensation leads the tag line, where it reads as the first fact about
    // the job rather than a figure stranded under it, and the actions move to
    // the right of the header, vertically centred against the tile.
    //
    // `relative` plus the stretched link on the title below: the whole card is
    // one click target without nesting anything inside an anchor, which would be
    // invalid markup and would swallow the Save and Apply buttons.
    <article className="relative flex items-start gap-body rounded-default border border-border-subtle bg-surface-base px-default py-body transition-colors hover:border-border-default">
      <CompanyLogo name={job.company_name} src={job.company_logo_url} size="card" />

      <div className="flex min-w-0 flex-1 flex-col gap-row">
        <p className="flex min-w-0 items-center gap-row text-small leading-none">
          <span className="truncate font-medium text-content-secondary">
            {job.company_name}
          </span>
          <span
            aria-hidden="true"
            className="size-hair shrink-0 rounded-full bg-content-tertiary"
          />
          {/*
            Just the elapsed time. The line used to read "Posted Aug 25
            [2 days ago]" — an absolute date and a relative one, the second in
            brackets as though annotating the first. Only one of them answers
            the question the feed is asking, and the exact date is on the detail
            page for the rare occasion it matters.
          */}
          <span className="shrink-0 text-content-tertiary">
            {posted.verb} {posted.elapsed}
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

        {/*
          One line of facts, compensation first.
          
          Nothing here renders a placeholder any more. DESIGN.md §7 decided that
          an absent tag implies the field was checked, and answered it with
          "Comp not listed" and "Yrs not stated" — but 59% of postings state no
          pay and 30% no years, so those two phrases were the most common text
          in the feed, occupying the space real facts would have used. Saying
          nothing is the better trade at that frequency: the detail page still
          distinguishes "not stated" from "not checked".
        */}
        <ul className="flex flex-wrap items-center gap-tight">
          {comp.known && (
            <li className="text-body font-semibold tabular-nums leading-none text-content-primary">
              {comp.value}
            </li>
          )}
          {job.employment_type && <Tag>{job.employment_type}</Tag>}
          {years.known && <Tag>{years.value}</Tag>}
          {locationTag && (
            <Tag>
              <span title={job.location_raw ?? undefined}>{locationTag}</span>
            </Tag>
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

      {/*
        Save and Apply, together, because they are the two things you do with a
        posting. z-10 keeps both above the title's stretched overlay.
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
          nothing to link to, and renders nothing rather than a disabled-looking
          "No link" chip sitting where a button should be.
        */}
        {job.url && (
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
              to {job.title} at {job.company_name} on their site, opens in a new
              tab
            </span>
          </a>
        )}
      </div>
    </article>
  );
}
