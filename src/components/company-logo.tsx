"use client";

import { useState } from "react";

/**
 * CompanyPreview tile. Figma node 12:142 inside JobCardWide.
 *
 * 68px wide, surface/sunken, 7px radius, with a border/subtle outline — the
 * outline matters when a logo is itself near-white, which several are.
 *
 * One deliberate deviation from the frame: the tile is 68px square there, but
 * self-stretches here so its top and bottom land exactly on the top and bottom
 * of the detail column beside it. That was an explicit request, and it is also
 * the only version that survives real data — a job title that wraps to two
 * lines makes the detail column taller than 68px, and a fixed square would
 * float short of the bottom edge on exactly those cards. Width stays fixed so
 * the grid does not shift.
 *
 * The monogram is the designed fallback rather than an error state: the URL is
 * resolved from the company's own site, so it can 404 or change format, and a
 * letter tile reads as intentional where a broken-image glyph reads as broken.
 *
 * Plain <img> rather than next/image because these are arbitrary third-party
 * hosts; next/image would need each one in remotePatterns, so a newly ingested
 * company would silently fail to render until config caught up.
 */
export function CompanyLogo({
  name,
  src,
}: {
  name: string;
  src: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="flex w-logo min-h-logo shrink-0 self-stretch items-center justify-center overflow-hidden rounded-preview border border-border-subtle bg-surface-sunken"
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full max-h-logo object-contain p-compact"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-monogram font-semibold leading-none tracking-mid text-content-primary">
          {initial}
        </span>
      )}
    </span>
  );
}
