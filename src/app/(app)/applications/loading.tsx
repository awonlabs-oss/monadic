import { PageHeadingSkeleton, LoadingAnnouncement } from "@/components/skeleton";

/** The tracked board, while application_overview is read. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <LoadingAnnouncement what="tracked applications" />
      <PageHeadingSkeleton />
      <div
        aria-hidden="true"
        className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base p-default"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="block h-8 rounded-tag bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
