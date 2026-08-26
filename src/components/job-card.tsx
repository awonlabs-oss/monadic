import type { JobListItem } from "@/lib/data/jobs";
import { formatComp, formatYears, ageBadge } from "@/lib/format";

/**
 * JobCard — feed card. Figma node 2:2, page `monadic — v0`.
 *
 * Structure and every value below map to the Figma frame: 18px radius
 * (radius/large), 20/18 padding, 14px internal gap, a 38px monogram tile on
 * surface/sunken at 11px radius, tag pills on accent/muted, a 1px divider, and
 * a footer pairing the compensation figure with the ink Track pill.
 *
 * The card is built around absence rather than around the happy path, because
 * absence is the common case: 59% of ingested postings state no compensation
 * and 39% state no years-required. Per DESIGN.md section 7, both render copy in
 * the same slot a value would occupy, so rows stay aligned and a missing figure
 * never collapses the layout.
 */

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-full bg-accent-muted px-compact py-[0.3125rem] text-caption font-medium leading-none text-content-secondary">
      {children}
    </li>
  );
}

/** First letter of the company, as the mock's monogram tile. */
function Monogram({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-[2.375rem] shrink-0 items-center justify-center rounded-logo bg-surface-sunken text-body font-semibold leading-none text-content-primary"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function JobCard({ job }: { job: JobListItem }) {
  const comp = formatComp(job);
  const years = formatYears(job);

  // The mock shows "NYC · Hybrid". Real location_raw is frequently multi-valued
  // and long ("New York City, NY; San Francisco, CA | New York City, NY"), so
  // the tag takes the first location only and the full string stays available
  // as the title attribute rather than being truncated away silently.
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
    <article className="flex flex-col gap-snug rounded-large border border-border-subtle bg-surface-base px-comfortable py-default">
      <header className="flex items-center justify-between">
        <Monogram name={job.company_name} />
        <button
          type="button"
          className="rounded-full border border-border-subtle bg-surface-base px-[0.6875rem] py-[0.4375rem] text-caption font-medium leading-none text-content-secondary"
          aria-label={`Save ${job.title} at ${job.company_name}`}
        >
          Save
        </button>
      </header>

      <p className="flex items-center gap-tight text-small leading-none">
        <span className="font-medium text-content-secondary">{job.company_name}</span>
        <span className="text-content-tertiary">{ageBadge(job.first_seen_at)}</span>
      </p>

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
          An absent tag would imply the field was checked and did not apply.
          DESIGN.md section 7 is explicit that years renders "Yrs not stated"
          instead of being omitted.
        */}
        <Tag>{years.known ? years.value : "Yrs not stated"}</Tag>
        {locationTag ? (
          <Tag>
            <span title={job.location_raw ?? undefined}>{locationTag}</span>
          </Tag>
        ) : (
          <Tag>Location not stated</Tag>
        )}
      </ul>

      <div aria-hidden="true" className="h-px w-full bg-border-subtle" />

      <footer className="flex items-center justify-between gap-snug">
        <div className="flex min-w-0 flex-col gap-[0.1875rem] leading-none">
          {comp.known ? (
            <p className="text-figure font-semibold tracking-snug text-content-primary tabular-nums">
              {comp.value}
            </p>
          ) : (
            <p className="text-body text-content-tertiary">Comp not listed</p>
          )}
          {/*
            The mock's second line reads "Series B · 60 people". Company stage
            and headcount are not available from any ATS and are not columns on
            the companies table, so the slot carries the provenance of the comp
            figure instead — which is real, and which the reader needs in order
            to know how much to trust the number above it.
          */}
          <p className="truncate text-caption text-content-tertiary">
            {comp.known && comp.caveat
              ? "Parsed from description"
              : `${job.company_name} · ${job.source}`}
          </p>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-full bg-accent-default px-[1rem] py-compact text-small font-medium leading-none text-content-inverse"
          aria-label={`Track ${job.title} at ${job.company_name}`}
        >
          Track
        </button>
      </footer>
    </article>
  );
}
