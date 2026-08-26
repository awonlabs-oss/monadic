import type { JobListItem } from "@/lib/data/jobs";
import { formatComp, formatYears, ageBadge } from "@/lib/format";
import { CompanyLogo } from "./company-logo";

/**
 * JobCard — feed card.
 *
 * Logo is a full-height column on the left; everything describing the job reads
 * as one block to its right. This supersedes the 38px inline monogram in the v0
 * Figma frame, at the author's direction — the frame should be updated to match.
 *
 * What the card does NOT say is as deliberate as what it does. It never shows
 * which ATS the posting came from: that is plumbing, the company is already
 * named, and a "greenhouse" label answers a question no one reading a job feed
 * is asking. The footer's second line carries the compensation's provenance
 * only when there is something worth qualifying, and is otherwise absent
 * rather than padded with filler.
 *
 * Absence is designed, not defaulted: 59% of postings state no pay and 30% no
 * years, so both render copy in the slot a value would occupy (DESIGN.md §7).
 */

function Tag({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li
      className={`rounded-full px-compact py-[0.3125rem] text-caption font-medium leading-none ${
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
  const comp = formatComp(job);
  const years = formatYears(job);

  // Real locations are frequently multi-valued and long
  // ("New York City, NY; San Francisco, CA | New York City, NY"), so the tag
  // shows the first and keeps the full string in the title attribute rather
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
    <article className="flex gap-comfortable rounded-large border border-border-subtle bg-surface-base px-comfortable py-default">
      <CompanyLogo name={job.company_name} src={job.company_logo_url} />

      <div className="flex min-w-0 flex-1 flex-col gap-snug">
        <header className="flex items-start justify-between gap-snug">
          <p className="flex min-w-0 items-center gap-tight text-small leading-none">
            <span className="truncate font-medium text-content-secondary">
              {job.company_name}
            </span>
            <span className="shrink-0 text-content-tertiary">
              {ageBadge(job.first_seen_at)}
            </span>
          </p>
          <button
            type="button"
            className="shrink-0 rounded-full border border-border-subtle bg-surface-base px-[0.6875rem] py-[0.4375rem] text-caption font-medium leading-none text-content-secondary"
            aria-label={`Save ${job.title} at ${job.company_name}`}
          >
            Save
          </button>
        </header>

        <h3 className="text-lead font-semibold leading-default tracking-snug text-content-primary">
          {job.url ? (
            <a href={job.url} target="_blank" rel="noreferrer noopener">
              {job.title}
            </a>
          ) : (
            job.title
          )}
        </h3>

        <ul className="flex flex-wrap items-center gap-tight">
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

        <div aria-hidden="true" className="h-px w-full bg-border-subtle" />

        <footer className="flex items-end justify-between gap-snug">
          <div className="flex min-w-0 flex-col gap-[0.1875rem] leading-none">
            {comp.known ? (
              <p className="text-figure font-semibold tracking-snug tabular-nums text-content-primary">
                {comp.value}
              </p>
            ) : (
              <p className="text-body text-content-tertiary">Comp not listed</p>
            )}
            {comp.known && comp.caveat && (
              <p className="truncate text-caption text-content-tertiary">
                Parsed from description
              </p>
            )}
          </div>

          <button
            type="button"
            className="shrink-0 rounded-full bg-accent-default px-[1rem] py-compact text-small font-medium leading-none text-content-inverse"
            aria-label={`Track ${job.title} at ${job.company_name}`}
          >
            Track
          </button>
        </footer>
      </div>
    </article>
  );
}
