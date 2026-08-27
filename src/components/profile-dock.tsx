import Link from "next/link";
import { cookies } from "next/headers";
import { getProfile, getCriteria, criteriaChips } from "@/lib/data/profile";
import type { EducationRow, ExperienceRow } from "@/lib/data/profile";
import {
  flagEducation,
  flagExperience,
  profileGaps,
  reviewCount,
} from "@/profile/review";
import { DockShell } from "./dock-shell";

/**
 * ProfileDock — Figma frame `Screen / Home (feed + profile dock)`, node 22:471.
 *
 * The resume, the criteria it feeds, and the parsed sections, docked beside the
 * feed so that what you are matching against is on screen while you scan.
 *
 * Two departures from the frame, both because the frame shows a capability that
 * does not exist yet and a control that does nothing is worse than one that is
 * absent:
 *
 *   - The frame's second resume button is "Re-parse". The uploaded file is
 *     never stored — only the parsed result — so there is nothing on disk to
 *     re-parse. The slot holds "View all" instead, and re-parsing becomes real
 *     the day the file is stored.
 *   - The frame's section actions are "Edit" and "Add". Per-field editing is
 *     not built, so each section head links to /profile, which is where the
 *     full parse lives and where editing will land. The word is "Open" because
 *     that is what it does.
 *
 * The amber review banner is real, not decorative: see profile/review.ts for
 * what counts as a field the parse could not settle.
 */

const SKILL_LIMIT = 16;

function SectionHead({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-snug">
      <h3 className="text-micro font-medium uppercase tracking-wide text-content-tertiary">
        {label}
      </h3>
      <Link
        href={href}
        className="shrink-0 text-caption font-medium text-content-secondary transition-colors hover:text-content-primary"
      >
        Open
      </Link>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-tag bg-accent-muted px-compact py-tight text-caption font-medium leading-none text-content-secondary">
      {children}
    </li>
  );
}

/**
 * A dock entry. Flagged entries get the frame's dashed amber outline and carry
 * the reason beside their date rather than in a tooltip, because the point of
 * the flag is that you can see which one to fix without opening anything.
 */
function Entry({
  title,
  subtitle,
  meta,
  flag,
}: {
  title: string;
  subtitle: string | null;
  meta: string | null;
  flag: string | null;
}) {
  return (
    <li
      className={`flex flex-col gap-xtight rounded-card border bg-surface-base px-entry-x py-entry-y ${
        flag ? "border-dashed border-badge-amber-fg" : "border-border-subtle"
      }`}
    >
      <p className="text-small font-medium leading-tight text-content-primary">
        {title}
      </p>
      {subtitle && (
        <p className="text-caption leading-tight text-content-secondary">
          {subtitle}
        </p>
      )}
      {(meta || flag) && (
        <p className="flex flex-wrap items-center gap-row text-meta leading-none">
          {meta && <span className="text-content-tertiary">{meta}</span>}
          {flag && (
            <span className="font-medium text-badge-amber-fg">{flag}</span>
          )}
        </p>
      )}
    </li>
  );
}

function experienceMeta(row: ExperienceRow): string | null {
  const start =
    row.start_text ?? (row.start_date ? row.start_date.slice(0, 7) : null);
  const end = row.is_current ? "Present" : (row.end_text ?? null);
  if (!start && !end) return null;
  return [start ?? "?", end ?? "?"].join(" – ");
}

function educationMeta(row: EducationRow): string | null {
  if (row.end_year) return `Class of ${row.end_year}`;
  if (row.start_year) return `From ${row.start_year}`;
  return null;
}

export async function ProfileDock() {
  const cookieStore = await cookies();
  const open = cookieStore.get("dock")?.value !== "0";

  // The panel renders even when the cookie says collapsed, and DockShell hides
  // it. Skipping the fetch would be cheaper, but expanding is a client-side
  // toggle with no round trip — there would be nothing to reveal, so the panel
  // would open empty and stay that way until the next navigation.
  const [{ profile, experiences, skills, education }, criteria] =
    await Promise.all([getProfile(), getCriteria()]);

  const parsed = Boolean(profile?.parsed_at);
  const chips = criteriaChips(criteria);
  const needsReview = reviewCount(profile, experiences, education);
  const gaps = profileGaps(profile);
  const shownSkills = skills.slice(0, SKILL_LIMIT);

  const parsedOn = profile?.parsed_at
    ? new Date(profile.parsed_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <DockShell defaultOpen={open}>
      {/* Resume */}
      <div className="flex flex-col gap-cozy rounded-default bg-surface-sunken px-card-x py-card-y">
        <div className="flex items-center gap-control">
          <svg
            aria-hidden="true"
            viewBox="0 0 17 17"
            className="size-icon shrink-0 text-content-tertiary"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.5 1.5H4.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" />
            <path d="M9.5 1.5v4h4" />
          </svg>
          <div className="flex min-w-0 flex-col gap-line">
            <p className="truncate text-small font-medium leading-none text-content-primary">
              {profile?.source_file_name ?? "No resume yet"}
            </p>
            <p className="text-caption leading-none text-content-tertiary">
              {parsedOn
                ? `Parsed ${parsedOn}`
                : "Upload one to build your profile"}
            </p>
          </div>
        </div>

        <div className="flex gap-row">
          <Link
            href="/profile"
            className="flex-1 rounded-subtle bg-accent-default py-row text-center text-caption font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
          >
            {parsed ? "Replace" : "Upload"}
          </Link>
          {parsed && (
            <Link
              href="/profile"
              className="flex-1 rounded-subtle border border-border-subtle bg-surface-base py-row text-center text-caption font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
            >
              View all
            </Link>
          )}
        </div>
      </div>

      {needsReview > 0 && (
        <Link
          href="/profile"
          className="flex items-center gap-chip rounded-card bg-badge-amber-bg px-cozy py-compact text-caption font-medium leading-none text-badge-amber-fg"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 14 14"
            className="size-icon-sm shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 1.5 13 12.5H1z" />
            <path d="M7 5.5v3M7 10.5v.01" />
          </svg>
          {needsReview} parsed{" "}
          {needsReview === 1 ? "field needs" : "fields need"} review
        </Link>
      )}

      {/* Match criteria */}
      <section className="flex flex-col gap-control">
        {/* The one section head that does not go to /profile: criteria are
            authored where they take effect. */}
        <SectionHead label="Match criteria" href="/for-you?edit=1" />
        {chips.length === 0 ? (
          <p className="text-caption leading-relaxed text-content-tertiary">
            None set, so For You has nothing to rank against.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-tight">
              {chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </ul>
            <p className="text-caption leading-none text-content-tertiary">
              Drives the feed and your saved views.
            </p>
          </>
        )}
      </section>

      {parsed && (
        <>
          <section className="flex flex-col gap-compact">
            <SectionHead label="Experience" href="/profile" />
            {experiences.length === 0 ? (
              <p className="text-caption text-content-tertiary">
                Nothing found in the resume.
              </p>
            ) : (
              <ul className="flex flex-col gap-compact">
                {experiences.map((row) => (
                  <Entry
                    key={row.id}
                    title={row.title ?? "Title not stated"}
                    subtitle={[row.company_name, row.location]
                      .filter(Boolean)
                      .join(" · ")}
                    meta={experienceMeta(row)}
                    flag={flagExperience(row)?.note ?? null}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-compact">
            <SectionHead label="Education" href="/profile" />
            {education.length === 0 ? (
              <p className="text-caption text-content-tertiary">
                Nothing found in the resume.
              </p>
            ) : (
              <ul className="flex flex-col gap-compact">
                {education.map((row) => (
                  <Entry
                    key={row.id}
                    title={row.institution}
                    subtitle={
                      [row.degree, row.field].filter(Boolean).join(", ") || null
                    }
                    meta={educationMeta(row)}
                    flag={flagEducation(row)?.note ?? null}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-control">
            <SectionHead label="Skills" href="/profile" />
            {skills.length === 0 ? (
              <p className="text-caption text-content-tertiary">
                Nothing found in the resume.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-tight">
                {shownSkills.map((s) => (
                  <Chip key={s.id}>{s.name}</Chip>
                ))}
                {skills.length > shownSkills.length && (
                  <li className="self-center text-caption text-content-tertiary">
                    +{skills.length - shownSkills.length} more
                  </li>
                )}
              </ul>
            )}
          </section>
        </>
      )}

      {/*
        Said explicitly rather than left as an empty panel: with no resume
        parsed there is nothing below the criteria, and a blank column reads as
        a broken one.
      */}
      {!parsed && gaps === 0 && (
        <p className="text-caption leading-relaxed text-content-tertiary">
          Experience, education and skills appear here once a resume has been
          parsed.
        </p>
      )}
    </DockShell>
  );
}
