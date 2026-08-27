import Link from "next/link";
import { recommendJobs } from "@/lib/data/jobs";
import { getCriteria, getProfile } from "@/lib/data/profile";
import { criteriaOrDraft } from "@/lib/data/criteria";
import { JobCard } from "@/components/job-card";
import { CriteriaEditor } from "@/components/criteria-editor";
import { ProfileDock } from "@/components/profile-dock";

/*
 * /for-you — the recommendation feed.
 *
 * The distinction from /jobs is not the ordering, it is the question being
 * asked. /jobs answers "what is out there", takes a query and filters, and
 * pages through 6,666 postings. This answers "what should I look at today", and
 * is bounded, ranked and explained.
 *
 * Bounded because a recommendation you never reach is not a recommendation.
 * Ranked by how many stated criteria a posting meets, and — the part that keeps
 * it honest — every card says which ones, so a bad ranking is legible as a bad
 * criterion rather than as a feed that has stopped working.
 *
 * Saved and tracked jobs are excluded. They have been decided on, and leaving
 * them here means the same postings greet you every visit while new ones sit
 * underneath them.
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ForYouPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const showAll = params.all === "1";
  const editing = params.edit === "1";

  const [saved, { profile, experiences }] = await Promise.all([
    getCriteria(),
    getProfile(),
  ]);
  const { input: criteria, isDraft } = criteriaOrDraft(
    saved,
    profile,
    experiences,
  );

  // A draft is shown, never applied. Running the feed off criteria you have not
  // agreed to would make the ranking depend on something you never saw.
  const active = isDraft ? null : criteria;
  const { jobs, total } = active
    ? await recommendJobs(active, showAll ? 100 : PAGE_SIZE)
    : { jobs: [], total: 0 };

  const stated = [
    criteria.targetRoleTypes.length > 0 && "roles",
    (criteria.yearsMin !== null || criteria.yearsMax !== null) && "experience",
    criteria.compFloor !== null && "pay",
    criteria.locations.length > 0 && "location",
    criteria.remotePreference && "workplace",
  ].filter(Boolean) as string[];

  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col gap-snug px-page pt-section pb-page">
        <header className="flex flex-wrap items-start justify-between gap-snug pb-tight">
          <div className="flex flex-col gap-tight">
            <h1 className="text-title font-semibold tracking-tight text-content-primary">
              For You
            </h1>
            <p className="text-body text-content-secondary">
              {!active ? (
                "Set your match criteria and this becomes a ranked feed."
              ) : total === 0 ? (
                "Nothing matches your criteria in this window."
              ) : (
                <>
                  {Math.min(jobs.length, total).toLocaleString()} of{" "}
                  {total.toLocaleString()} matching{" "}
                  {total === 1 ? "role" : "roles"}, best fit first
                </>
              )}
            </p>
          </div>

          <Link
            href={editing ? "/for-you" : "/for-you?edit=1"}
            className="rounded-subtle border border-border-subtle bg-surface-base px-default py-compact text-small font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
          >
            {editing ? "Done" : active ? "Edit criteria" : "Set criteria"}
          </Link>
        </header>

        {(editing || !active) && (
          <section
            aria-labelledby="criteria-heading"
            className="flex flex-col gap-body rounded-default border border-border-subtle bg-surface-base px-panel-x py-panel-y"
          >
            <h2
              id="criteria-heading"
              className="text-lead font-semibold tracking-snug text-content-primary"
            >
              Match criteria
            </h2>
            <CriteriaEditor
              criteria={criteria}
              isDraft={isDraft}
              hasResume={Boolean(profile?.parsed_at)}
            />
          </section>
        )}

        {active && jobs.length === 0 && (
          <p className="text-body leading-relaxed text-content-secondary">
            {stated.length === 0 ? (
              <>
                No criteria are set, so there is nothing to rank against.{" "}
                <Link
                  href="/for-you?edit=1"
                  className="underline underline-offset-2"
                >
                  Set them
                </Link>
                .
              </>
            ) : (
              <>
                Nothing in the last {criteria.recencyDays} days matches on{" "}
                {stated.join(", ")}. Widen the window or loosen a criterion —{" "}
                <Link
                  href="/for-you?edit=1"
                  className="underline underline-offset-2"
                >
                  edit criteria
                </Link>
                {" — or "}
                <Link href="/jobs" className="underline underline-offset-2">
                  search everything
                </Link>
                .
              </>
            )}
          </p>
        )}

        {jobs.length > 0 && (
          <section
            aria-labelledby="feed-heading"
            className="flex flex-col gap-snug"
          >
            <h2 id="feed-heading" className="sr-only">
              Recommended roles
            </h2>
            <ul className="flex flex-col gap-snug">
              {jobs.map((job) => (
                <li key={job.id}>
                  <JobCard
                    job={job}
                    match={{
                      matched: job.matched,
                      applicable: job.applicable,
                      keys: job.matched_keys,
                    }}
                  />
                </li>
              ))}
            </ul>

            {/*
              Not pagination. Reaching page four of a recommendation feed means
              the recommendations ran out three pages ago; the escape hatch is
              the search page, where paging is the right model.
            */}
            {!showAll && total > jobs.length && (
              <p className="text-caption text-content-tertiary">
                Showing the {jobs.length} best matches.{" "}
                <Link
                  href="/for-you?all=1"
                  className="underline underline-offset-2 hover:text-content-primary"
                >
                  Show more
                </Link>
                {" or "}
                <Link
                  href="/jobs"
                  className="underline underline-offset-2 hover:text-content-primary"
                >
                  search all {total.toLocaleString()}
                </Link>
                .
              </p>
            )}
          </section>
        )}
      </div>

      <ProfileDock />
    </div>
  );
}
