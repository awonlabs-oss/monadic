import type { Status } from "@/lib/applications/pipeline";
import { STATUS_LABELS } from "@/lib/applications/pipeline";

/**
 * StatusBadge. Figma component 14:206, all nine variants.
 *
 * The component's own note in Figma: "Colour groups stages; the label and glyph
 * carry the distinction. Never use colour as the only signal." Both halves of
 * that are load-bearing here. Colour groups — the three interview stages share
 * one teal, because at a glance "in a process" is the fact you want, and which
 * kind is the detail. The glyph and the word carry the distinction, so the
 * badge still reads correctly in greyscale, which is the test DESIGN.md §9 sets.
 *
 * Saved is the one variant with no fill: it is the only status you assign
 * yourself rather than one the world assigns you, and a dashed outline says
 * provisional in a way a colour cannot.
 *
 * Geometry and paths are the frame's, unchanged — 15×15 at stroke width 1.6.
 */

const TONE: Record<Status | "needs_action", string> = {
  shortlisted:
    "border border-dashed border-border-default bg-surface-base text-badge-neutral-fg",
  applied: "bg-badge-slate-bg text-badge-slate-fg",
  recruiter_screen: "bg-badge-teal-bg text-badge-teal-fg",
  technical: "bg-badge-teal-bg text-badge-teal-fg",
  onsite: "bg-badge-teal-bg text-badge-teal-fg",
  offer: "bg-badge-green-bg text-badge-green-fg",
  rejected: "bg-badge-clay-bg text-badge-clay-fg",
  withdrawn: "bg-badge-neutral-bg text-badge-neutral-fg",
  needs_action: "bg-badge-amber-bg text-badge-amber-fg",
};

const PATHS: Record<Status | "needs_action", string[]> = {
  shortlisted: [
    "M11.875 13.125 7.5 10.625l-4.375 2.5V3.125c0-.332.132-.65.366-.884.234-.234.552-.366.884-.366h6.25c.331 0 .65.132.884.366.234.234.366.552.366.884v10Z",
  ],
  applied: [
    "M13.75 1.25 9.375 13.75l-2.5-5.625L1.25 5.625 13.75 1.25Z",
    "M13.75 1.25 6.875 8.125",
  ],
  recruiter_screen: [
    "M13.75 10.575V12.45a1.25 1.25 0 0 1-1.363 1.25 12.37 12.37 0 0 1-5.394-1.919 12.19 12.19 0 0 1-3.75-3.75A12.37 12.37 0 0 1 1.325 2.613 1.25 1.25 0 0 1 2.569 1.25h1.875a1.25 1.25 0 0 1 1.25 1.075c.079.6.226 1.19.437 1.756a1.25 1.25 0 0 1-.281 1.319L5.056 6.194a10 10 0 0 0 3.75 3.75l.794-.794a1.25 1.25 0 0 1 1.319-.281c.567.211 1.156.358 1.756.437a1.25 1.25 0 0 1 1.075 1.269Z",
  ],
  technical: ["M10 11.25 13.75 7.5 10 3.75", "M5 3.75 1.25 7.5 5 11.25"],
  onsite: [
    "M10 13.125v-1.25a2.5 2.5 0 0 0-2.5-2.5H3.75a2.5 2.5 0 0 0-2.5 2.5v1.25",
    "M5.625 6.875a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    "M13.75 13.125v-1.25a2.5 2.5 0 0 0-1.875-2.419",
    "M10 1.956a2.5 2.5 0 0 1 0 4.844",
  ],
  offer: [
    "M4.375 6.25v7.5",
    "M9.375 3.675 8.75 6.25h3.644a1.25 1.25 0 0 1 1.2 1.6l-1.457 5a1.25 1.25 0 0 1-1.2.9H2.5a1.25 1.25 0 0 1-1.25-1.25v-5A1.25 1.25 0 0 1 2.5 6.25h1.725a1.25 1.25 0 0 0 1.119-.694L7.5 1.25a2.5 2.5 0 0 1 1.875 2.425Z",
  ],
  rejected: [
    "M7.5 13.75a6.25 6.25 0 1 0 0-12.5 6.25 6.25 0 0 0 0 12.5Z",
    "M9.375 5.625 5.625 9.375",
    "M5.625 5.625 9.375 9.375",
  ],
  withdrawn: [
    "M13.125 1.875H1.875a.625.625 0 0 0-.625.625v1.875c0 .345.28.625.625.625h11.25c.345 0 .625-.28.625-.625V2.5a.625.625 0 0 0-.625-.625Z",
    "M2.5 5v6.875c0 .69.56 1.25 1.25 1.25h7.5c.69 0 1.25-.56 1.25-1.25V5",
    "M6.25 7.5h2.5",
  ],
  needs_action: [
    "M13.581 11.25 8.581 2.5a1.25 1.25 0 0 0-2.162 0l-5 8.75A1.25 1.25 0 0 0 2.5 13.125h10a1.25 1.25 0 0 0 1.081-1.875Z",
    "M7.5 5.625v2.5",
    "M7.5 10.625h.006",
  ],
};

export function StatusBadge({
  status,
  label,
}: {
  status: Status | "needs_action";
  /** Overrides the status's own name. Used by the needs-action variant. */
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-tight rounded-subtle py-tight pl-chip pr-control text-small font-medium leading-none ${TONE[status]}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 15 15"
        className="size-icon shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[status].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
      {label ?? STATUS_LABELS[status as Status] ?? status}
    </span>
  );
}
