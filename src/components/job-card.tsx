import Link from "next/link";
import type { JobListItem } from "@/lib/data/jobs";
import { formatComp, formatYears, postedLabel } from "@/lib/format";
import { CompanyLogo } from "./company-logo";
import { saveJobAction, trackJobAction } from "@/app/actions";

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

function Tag({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
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

export function JobCard({ job }: { job: JobListItem }) {
  const saved = job.interaction_state === "saved";
  const tracked = job.application_id !== null;
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
  const locationTag = [primaryLocation, remoteLabel].filter(Boolean).join(" · ");

  return (
    // No h-full and no growing body. Both existed to equalise card heights
    // across a two-column grid; the feed is one column now (frame 22:471), so
    // all they did was stretch every card to the tallest one on the page and
    // push the divider away from the content it separates. That stretch was
    // the dead space.
    <article className="flex flex-col gap-snug rounded-default border border-border-subtle bg-surface-base px-default pt-default pb-body">
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
              <span className="text-content-tertiary/80">[{posted.elapsed}]</span>
            </span>
          </p>

          <h3 className="text-lead font-semibold leading-default tracking-snug text-content-primary">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noreferrer noopener" className="hover:underline hover:underline-offset-2">
                {job.title}
              </a>
            ) : (
              job.title
            )}
          </h3>

          <ul className="flex flex-wrap items-start gap-tight">
            {job.employment_type && <Tag>{job.employment_type}</Tag>}
            {/*
              Years renders even when unknown. DESIGN.md §7: an absent tag would
              imply the field was checked and did not apply.
            */}
            {years.known ? <Tag>{years.value}</Tag> : <Tag muted>Yrs not stated</Tag>}
            {locationTag ? (
              <Tag>
                <span title={job.location_raw ?? undefined}>{locationTag}</span>
              </Tag>
            ) : (
              <Tag muted>Location not stated</Tag>
            )}
          </ul>
        </div>

        {/*
          Save is a bookmark; it does not put the job on the pipeline board.
          Track does. Keeping them separate is what stops a browsing session of
          forty saves from flooding the pipeline.
        */}
        <form action={saveJobAction} className="shrink-0">
          <input type="hidden" name="jobId" value={job.id} />
          <button
            type="submit"
            aria-label={
              saved
                ? `${job.title} at ${job.company_name} is saved`
                : `Save ${job.title} at ${job.company_name}`
            }
            aria-pressed={saved}
            className={`rounded-subtle border px-control py-tight text-caption font-medium leading-none transition-colors ${
              saved
                ? "border-border-default bg-surface-sunken text-content-primary hover:bg-surface-hover"
                : "border-border-subtle bg-surface-base text-content-secondary hover:bg-surface-hover hover:text-content-primary"
            }`}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </form>
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

        {tracked ? (
          <Link
            href="/applications"
            className="shrink-0 rounded-subtle border border-border-default bg-surface-sunken px-default py-compact text-small font-medium leading-none text-content-primary transition-colors hover:bg-surface-hover"
          >
            Tracked
          </Link>
        ) : (
          <form action={trackJobAction} className="shrink-0">
            <input type="hidden" name="jobId" value={job.id} />
            <button
              type="submit"
              className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
              aria-label={`Track ${job.title} at ${job.company_name}`}
            >
              Track
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
