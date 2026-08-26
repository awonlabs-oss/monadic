import { getProfile } from "@/lib/data/profile";
import { ResumeUpload } from "@/components/resume-upload";

/*
 * /profile — the parsed resume, split into sections.
 *
 * DESIGN.md §6 has no frame for this route, so it is structure and tokens only
 * and will stay that way until one exists. It is deliberately plain.
 *
 * Read-only for now. The brief is explicit that parsing will be imperfect and
 * that correcting it is the normal case, so per-field editing is the next step —
 * the schema already supports it, since every parsed row carries source =
 * 'parsed' and a re-upload replaces only those, leaving anything hand-entered
 * alone.
 */

export const dynamic = "force-dynamic";

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-content-tertiary">{children}</span>;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-compact">
      <h2 className="flex items-center gap-tight text-lead font-semibold tracking-snug text-content-primary">
        {title}
        {count !== undefined && (
          <span className="text-small font-medium tabular-nums text-content-tertiary">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function dateRange(row: {
  start_text: string | null;
  end_text: string | null;
  is_current: boolean;
}) {
  // The text as written is shown rather than the normalised date, because when
  // the normalisation is wrong this is what makes it obvious.
  const start = row.start_text ?? "?";
  const end = row.is_current ? "Present" : (row.end_text ?? "?");
  return `${start} – ${end}`;
}

export default async function ProfilePage() {
  const { profile, experiences, skills, education } = await getProfile();

  const domains = skills.filter((s) => s.category === "domain");
  const technical = skills.filter((s) => s.category !== "domain");

  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <header className="flex flex-col gap-tight">
        <h1 className="text-title font-semibold tracking-tight text-content-primary">
          Profile
        </h1>
        <p className="text-body text-content-secondary">
          {profile?.parsed_at
            ? `Parsed from ${profile.source_file_name ?? "a resume"}.`
            : "Upload a resume to build your profile."}
        </p>
      </header>

      <ResumeUpload hasProfile={Boolean(profile?.parsed_at)} />

      {!profile?.parsed_at ? null : (
        <>
          <Section title="Contact">
            <dl className="grid grid-cols-1 gap-compact sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Name", profile.full_name],
                ["Email", profile.email],
                ["Phone", profile.phone],
                ["Location", profile.location],
                ["Headline", profile.headline],
                [
                  "Experience",
                  profile.years_experience_total !== null
                    ? `${profile.years_experience_total} years`
                    : null,
                ],
                ["Level", profile.seniority_signal],
              ].map(([label, value]) => (
                <div key={label as string} className="flex flex-col gap-hair">
                  <dt className="text-caption text-content-tertiary">{label}</dt>
                  <dd className="text-body text-content-primary">
                    {value ?? <Empty>Not on resume</Empty>}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          {profile.summary && (
            <Section title="Summary">
              <p className="max-w-reading text-body leading-relaxed text-content-secondary">
                {profile.summary}
              </p>
            </Section>
          )}

          <Section title="Experience" count={experiences.length}>
            {experiences.length === 0 ? (
              <p className="text-body text-content-secondary">
                No roles were found. If the resume has them, the parse missed them —
                worth re-uploading or checking the file.
              </p>
            ) : (
              <ul className="flex flex-col gap-compact">
                {experiences.map((role) => (
                  <li
                    key={role.id}
                    className="flex flex-col gap-tight rounded-card border border-border-subtle bg-surface-base px-card-x py-card-y"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-tight">
                      <h3 className="text-body font-semibold text-content-primary">
                        {role.title ?? <Empty>Title not stated</Empty>}
                      </h3>
                      <span className="text-caption tabular-nums text-content-tertiary">
                        {dateRange(role)}
                      </span>
                    </div>
                    <p className="text-small text-content-secondary">
                      {role.company_name}
                      {role.location && (
                        <span className="text-content-tertiary"> · {role.location}</span>
                      )}
                    </p>
                    {role.description && (
                      <p className="max-w-reading text-caption leading-relaxed text-content-secondary">
                        {role.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Education" count={education.length}>
            {education.length === 0 ? (
              <p className="text-body text-content-secondary">Nothing found.</p>
            ) : (
              <ul className="flex flex-col gap-compact">
                {education.map((school) => (
                  <li
                    key={school.id}
                    className="flex flex-wrap items-baseline justify-between gap-tight rounded-card border border-border-subtle bg-surface-base px-card-x py-card-y"
                  >
                    <div className="flex flex-col gap-hair">
                      <h3 className="text-body font-semibold text-content-primary">
                        {school.institution}
                      </h3>
                      <p className="text-small text-content-secondary">
                        {[school.degree, school.field].filter(Boolean).join(", ") || (
                          <Empty>Degree not stated</Empty>
                        )}
                      </p>
                    </div>
                    <span className="text-caption tabular-nums text-content-tertiary">
                      {school.end_year ?? school.start_year ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Skills" count={skills.length}>
            {skills.length === 0 ? (
              <p className="text-body text-content-secondary">Nothing found.</p>
            ) : (
              <div className="flex flex-col gap-compact">
                <ul className="flex flex-wrap gap-tight">
                  {technical.map((skill) => (
                    <li
                      key={skill.id}
                      className="rounded-tag bg-accent-muted px-chip py-xtight text-caption font-medium text-content-secondary"
                    >
                      {skill.name}
                    </li>
                  ))}
                </ul>
                {domains.length > 0 && (
                  <>
                    <h3 className="text-caption font-medium uppercase text-content-tertiary">
                      Domains
                    </h3>
                    <ul className="flex flex-wrap gap-tight">
                      {domains.map((skill) => (
                        <li
                          key={skill.id}
                          className="rounded-tag bg-surface-sunken px-chip py-xtight text-caption font-medium text-content-secondary"
                        >
                          {skill.name}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
