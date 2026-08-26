import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getJob } from "@/lib/data/jobs";
import { parseDescription, type Run } from "@/lib/description";
import {
  formatComp,
  formatYears,
  postedLabel,
  relativeShort,
} from "@/lib/format";
import { CompanyLogo } from "@/components/company-logo";
import { saveJobAction, trackJobAction } from "@/app/actions";

/*
 * /jobs/[id] — one posting. Figma frame `Screen / Job detail`, node 50:348.
 *
 * Header card, description on the left, facts rail on the right.
 *
 * Three panels in the frame's rail are not built, because the data behind them
 * does not exist rather than because they were skipped:
 *
 *   - AGAINST YOUR CRITERIA needs search_criteria, which has no rows and no UI
 *     to author them yet. A checklist scoring a job against nothing would be
 *     six ticks that mean nothing.
 *   - COMPANY shows "Series B · 60 people" and a description. No ATS returns
 *     company stage, headcount or a blurb and there are no columns for them, so
 *     the panel carries what is real: the company, and how many other roles it
 *     has open.
 *   - CONTACTS HERE needs the contacts table, which is empty. The panel appears
 *     when there is a contact to put in it.
 *
 * KEY FACTS drops the frame's Equity and Travel rows for the same reason.
 * Compensation, Experience and Location do render when absent — DESIGN.md §7,
 * absence is designed — because those are fields we genuinely looked for. Equity
 * and Travel are fields nothing ever looked for, and "Not stated" would claim
 * otherwise.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job) return { title: "Job not found — Monadic" };
  return { title: `${job.title} at ${job.company.name} — Monadic` };
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-tag bg-accent-muted px-compact py-tight text-caption font-medium leading-none text-content-secondary">
      {children}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-snug">
      <dt className="shrink-0 text-small text-content-tertiary">{label}</dt>
      <dd className="text-right text-small font-medium text-content-primary">
        {value}
      </dd>
    </div>
  );
}

function Absent({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-content-tertiary">{children}</span>;
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-snug rounded-default border border-border-subtle bg-surface-base px-default py-body">
      <div className="flex items-center justify-between gap-snug">
        <h2 className="text-micro font-medium uppercase tracking-wide text-content-tertiary">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Inline runs. Every one renders as a text node; nothing here is markup. */
function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) => {
        const text = run.bold ? (
          <strong className="font-semibold text-content-primary">
            {run.text}
          </strong>
        ) : run.italic ? (
          <em>{run.text}</em>
        ) : (
          run.text
        );
        return run.href ? (
          <a
            key={i}
            href={run.href}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="underline underline-offset-2 hover:text-content-primary"
          >
            {text}
          </a>
        ) : (
          <span key={i}>{text}</span>
        );
      })}
    </>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const job = await getJob((await params).id);
  if (!job) notFound();

  // Abbreviated for the header tag, written out in full for the facts list.
  const comp = formatComp(job);
  const compFull = formatComp(job, { precise: true });
  const years = formatYears(job);
  const posted = postedLabel(job.posted_at, job.first_seen_at);
  const saved = job.interaction_state === "saved";
  const tracked = job.application_id !== null;
  const blocks = parseDescription(job.description_html);

  const remote =
    job.remote_policy === "remote"
      ? "Remote"
      : job.remote_policy === "hybrid"
        ? "Hybrid"
        : job.remote_policy === "onsite"
          ? "On-site"
          : null;
  const place = job.location_raw?.split(/[;|]/)[0]?.trim() || null;
  const locationLine = [place, remote].filter(Boolean).join(" · ") || null;

  return (
    <div className="flex flex-col gap-snug px-page pt-comfortable pb-page">
      <nav
        aria-label="Breadcrumb"
        className="text-caption text-content-tertiary"
      >
        <Link
          href="/jobs"
          className="hover:text-content-primary hover:underline"
        >
          For You
        </Link>
        <span aria-hidden="true" className="px-tight">
          /
        </span>
        <span className="text-content-secondary">{job.company.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-comfortable rounded-default border border-border-subtle bg-surface-base px-panel-x py-panel-y">
        <div className="flex items-start gap-default">
          <CompanyLogo name={job.company.name} src={job.company.logo_url} />
          <div className="flex min-w-0 flex-1 flex-col gap-compact">
            <h1 className="text-title font-semibold leading-tight tracking-tight text-content-primary">
              {job.title}
            </h1>
            <p className="flex flex-wrap items-center gap-chip text-small leading-none">
              <span className="font-medium text-content-secondary">
                {job.company.name}
              </span>
              {[locationLine, `${posted.verb} ${posted.date}`, job.department]
                .filter(Boolean)
                .map((part) => (
                  <span
                    key={part as string}
                    className="flex items-center gap-chip"
                  >
                    <span
                      aria-hidden="true"
                      className="size-hair shrink-0 rounded-full bg-content-tertiary"
                    />
                    <span className="text-content-tertiary">{part}</span>
                  </span>
                ))}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-snug">
          <ul className="flex flex-wrap items-start gap-tight">
            {job.employment_type && <Tag>{job.employment_type}</Tag>}
            {years.known && <Tag>{years.value}</Tag>}
            {comp.known && <Tag>{comp.value}</Tag>}
            {job.closed_at && <Tag>Closed</Tag>}
          </ul>

          <div className="flex flex-wrap items-center gap-compact">
            <form action={saveJobAction}>
              <input type="hidden" name="jobId" value={job.id} />
              <button
                type="submit"
                aria-pressed={saved}
                className={`rounded-subtle border px-body py-compact text-small font-medium leading-none transition-colors ${
                  saved
                    ? "border-border-default bg-surface-sunken text-content-primary hover:bg-surface-hover"
                    : "border-border-subtle bg-surface-base text-content-secondary hover:bg-surface-hover hover:text-content-primary"
                }`}
              >
                {saved ? "Saved" : "Save"}
              </button>
            </form>

            {tracked ? (
              <Link
                href="/applications"
                className="rounded-subtle border border-border-default bg-surface-sunken px-body py-compact text-small font-medium leading-none text-content-primary transition-colors hover:bg-surface-hover"
              >
                Tracked
              </Link>
            ) : (
              <form action={trackJobAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <button
                  type="submit"
                  className="rounded-subtle border border-border-subtle bg-surface-base px-body py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
                >
                  Track this
                </button>
              </form>
            )}

            {/*
              The frame's ink button is "Track this" and its third button is
              "Open original". Applying is the action that actually moves this
              job forward and the only one that leaves the app, so it takes the
              emphasis; tracking is one click away either side of it.

              Every application happens on the company's own board. There is no
              in-app apply to fall back to, so a posting whose URL never came
              through says so rather than rendering a dead button.
            */}
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-tight rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
              >
                Apply
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="size-icon-xs"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4.5 2.5h5v5M9.5 2.5 4 8M9 7.5v2h-7v-7h2" />
                </svg>
                <span className="sr-only">
                  {" "}
                  on {job.company.name}&rsquo;s site, opens in a new tab
                </span>
              </a>
            ) : (
              <span className="rounded-subtle border border-border-subtle bg-surface-sunken px-body py-compact text-small text-content-tertiary">
                No application link
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-snug lg:flex-row lg:items-start">
        {/* Description */}
        <article className="flex min-w-0 flex-1 flex-col gap-body">
          {blocks.length === 0 ? (
            <p className="text-body text-content-secondary">
              This posting arrived without a description. Apply on the
              company&rsquo;s board to see the full listing.
            </p>
          ) : (
            blocks.map((block, i) => {
              if (block.kind === "rule") {
                return (
                  <hr
                    key={i}
                    className="h-px w-full border-0 bg-border-subtle"
                  />
                );
              }
              if (block.kind === "heading") {
                return (
                  <h2
                    key={i}
                    className="pt-compact text-lead font-semibold tracking-snug text-content-primary"
                  >
                    <Runs runs={block.runs} />
                  </h2>
                );
              }
              if (block.kind === "list") {
                const List = block.ordered ? "ol" : "ul";
                return (
                  <List
                    key={i}
                    className={`flex flex-col gap-compact ps-body text-body leading-relaxed text-content-secondary ${
                      block.ordered ? "list-decimal" : "list-disc"
                    }`}
                  >
                    {block.items.map((item, j) => (
                      <li
                        key={j}
                        className="ps-tight marker:text-content-tertiary"
                      >
                        <Runs runs={item} />
                      </li>
                    ))}
                  </List>
                );
              }
              return (
                <p
                  key={i}
                  className="text-body leading-relaxed text-content-secondary"
                >
                  <Runs runs={block.runs} />
                </p>
              );
            })
          )}

          {/*
            Said plainly rather than left to be discovered. This is a copy of
            someone else's posting, taken at a known moment, reformatted by us —
            all three of those are reasons it could disagree with the original,
            and the original is the one you apply through.
          */}
          <p className="rounded-card bg-surface-sunken px-card-x py-card-y text-caption leading-relaxed text-content-tertiary">
            Shown as published on {job.company.name}&rsquo;s {job.source} board
            and last checked {relativeShort(job.last_seen_at)}. Formatting is
            ours, so it will differ from the original. Always apply through the
            original posting.
          </p>
        </article>

        {/* Rail */}
        <aside className="flex w-full shrink-0 flex-col gap-snug lg:w-rail">
          <Panel title="Key facts">
            <dl className="flex flex-col gap-control">
              <Fact
                label="Compensation"
                value={
                  compFull.known ? (
                    <>
                      {compFull.value}
                      {compFull.caveat && (
                        <span className="block text-caption font-normal text-content-tertiary">
                          {compFull.caveat}
                        </span>
                      )}
                    </>
                  ) : (
                    <Absent>Not listed</Absent>
                  )
                }
              />
              <Fact
                label="Experience"
                value={years.known ? years.value : <Absent>Not stated</Absent>}
              />
              <Fact
                label="Location"
                value={
                  job.location_raw ? (
                    <span title={job.location_raw}>
                      {locationLine ?? job.location_raw}
                    </span>
                  ) : (
                    <Absent>Not stated</Absent>
                  )
                }
              />
              <Fact
                label="Employment"
                value={job.employment_type ?? <Absent>Not stated</Absent>}
              />
              {job.department && (
                <Fact label="Department" value={job.department} />
              )}
              {job.team && <Fact label="Team" value={job.team} />}
              {/*
                Provenance, which is exactly where the ATS name belongs — it is
                what tells you how fresh this copy is. It stays off the feed
                card, where it is noise.
              */}
              <Fact
                label="Source"
                value={
                  <span className="capitalize">
                    {job.source}
                    <span className="font-normal text-content-tertiary">
                      {" · "}
                      {relativeShort(job.last_seen_at)}
                    </span>
                  </span>
                }
              />
            </dl>
          </Panel>

          <Panel
            title="Company"
            action={
              <Link
                href={`/jobs?q=${encodeURIComponent(job.company.name)}`}
                className="text-caption text-content-secondary transition-colors hover:text-content-primary"
              >
                View all roles
              </Link>
            }
          >
            <div className="flex flex-col gap-cozy">
              <div className="flex items-center gap-control">
                <CompanyLogo
                  name={job.company.name}
                  src={job.company.logo_url}
                  size="small"
                />
                <div className="flex min-w-0 flex-col gap-line">
                  <p className="truncate text-body font-medium leading-tight text-content-primary">
                    {job.company.name}
                  </p>
                  {job.company.website_url && (
                    <a
                      href={job.company.website_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-caption leading-tight text-content-tertiary hover:text-content-secondary hover:underline"
                    >
                      {job.company.website_url
                        .replace(/^https?:\/\/(www\.)?/, "")
                        .replace(/\/$/, "")}
                    </a>
                  )}
                </div>
              </div>
              <p className="border-t border-border-subtle pt-control text-caption leading-none text-content-secondary">
                {job.other_open_roles === 0
                  ? "No other roles open here"
                  : `${job.other_open_roles.toLocaleString()} other open ${
                      job.other_open_roles === 1 ? "role" : "roles"
                    }`}
              </p>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
