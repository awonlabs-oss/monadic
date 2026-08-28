import {
  JobListSkeleton,
  PageHeadingSkeleton,
  LoadingAnnouncement,
} from "@/components/skeleton";

/**
 * Shown while recommend_jobs scores the corpus against your criteria, which is
 * the slowest read in the app at roughly 1.2 seconds. This is the page the
 * latency complaint was actually about.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <LoadingAnnouncement what="your recommendations" />
      <PageHeadingSkeleton />
      <JobListSkeleton rows={5} />
    </div>
  );
}
