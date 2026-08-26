"use client";

import { useState } from "react";

/**
 * CompanyPreview tile. Figma node 12:142 inside JobCardWide.
 *
 * A 68px square on surface/sunken with a 7px radius and a border/subtle
 * outline — the outline matters because several of these logos are themselves
 * near-white and would otherwise dissolve into the tile.
 *
 * The image fills the tile via object-cover rather than being letterboxed
 * inside padding. Cover crops rather than shrinks, so a non-square logo loses
 * its edges instead of floating in a sea of grey; favicons and apple-touch
 * icons are square almost without exception, so in practice nothing is lost.
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
      className="flex size-logo shrink-0 items-center justify-center overflow-hidden rounded-preview border border-border-subtle bg-surface-sunken"
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
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
