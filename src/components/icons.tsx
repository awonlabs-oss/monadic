/**
 * Glyphs lifted from the Figma StatusBadge component, node 14:206.
 *
 * Inline paths rather than downloaded SVG files: these are two shapes, and a
 * file each would mean two network requests and a colour baked into the asset.
 * As markup they inherit currentColor, so one glyph serves a white button, an
 * ink button and a badge without a second copy.
 *
 * The geometry is the frame's, unchanged — 15×15 at stroke width 1.6.
 */

const base = {
  "aria-hidden": true as const,
  viewBox: "0 0 15 15",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * The paper plane the frame gives the Applied status. It is on the Apply button
 * for exactly that reason: the glyph you press is the glyph the card wears
 * afterwards, so the button says what it is about to make true.
 */
export function SendIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M13.75 1.25 9.375 13.75l-2.5-5.625L1.25 5.625 13.75 1.25Z" />
      <path d="M13.75 1.25 6.875 8.125" />
    </svg>
  );
}

/** The bookmark from the Saved status. */
export function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg {...base} className={className}>
      <path d="M11.875 13.125 7.5 10.625l-4.375 2.5V3.125c0-.332.132-.65.366-.884.234-.234.552-.366.884-.366h6.25c.331 0 .65.132.884.366.234.234.366.552.366.884v10Z" />
    </svg>
  );
}
