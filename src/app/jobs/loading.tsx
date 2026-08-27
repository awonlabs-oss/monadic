import {
  JobListSkeleton,
  PageHeadingSkeleton,
  LoadingAnnouncement,
} from "@/components/skeleton";

/**
 * Shown while search_jobs and job_facets run — together about 600ms.
 *
 * Its real job is to exist. Without a loading boundary Next.js holds the
 * previous page on screen for the whole navigation, so clicking Jobs did
 * nothing visible until the query came back.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <LoadingAnnouncement what="jobs" />
      <PageHeadingSkeleton />
      <JobListSkeleton rows={6} />
    </div>
  );
}
