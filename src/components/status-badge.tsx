/**
 * StatusBadge. Figma node 14:206.
 *
 * The component's own note in Figma: "Colour groups stages; the label and glyph
 * carry the distinction. Never use colour as the only signal." So the badge is
 * a triangle glyph plus words, and the amber only reinforces them — it would
 * still read correctly in greyscale, which is the test DESIGN.md §9 sets.
 */
export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-tight rounded-subtle bg-badge-amber-bg py-tight pl-chip pr-control text-small font-medium leading-none text-badge-amber-fg">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-[0.9375rem] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 2.5 14.5 13.5H1.5L8 2.5Z" />
        <path d="M8 6.5v3" />
        <path d="M8 11.5h.01" />
      </svg>
      {label}
    </span>
  );
}
