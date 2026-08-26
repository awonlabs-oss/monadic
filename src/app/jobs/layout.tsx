import { ProfileDock } from "@/components/profile-dock";

/*
 * The home screen: feed on the left, profile dock on the right.
 * Figma frame `Screen / Home (feed + profile dock)`, node 22:471.
 *
 * The dock lives in a layout rather than in the page so that it is not torn
 * down and re-fetched on every filter change — paging and filtering re-render
 * the page underneath it while the dock's data stays put.
 *
 * The row stretches rather than aligning to the top, so the dock's left border
 * runs the full height of the page even when the dock has less in it than the
 * feed. The panel inside it is what sticks to the viewport.
 */
export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 px-page pt-section pb-page">{children}</div>
      <ProfileDock />
    </div>
  );
}
