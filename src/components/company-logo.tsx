"use client";

import { useState } from "react";

/**
 * Company logo, falling back to a monogram.
 *
 * The URL is resolved from the company's own site, so it can 404, expire, or be
 * a format the browser rejects. The monogram is the designed fallback rather
 * than an error state — a card with a letter tile looks intentional, a card
 * with a broken-image glyph looks broken.
 *
 * Client component solely for the onError swap; there is no other state here.
 *
 * Plain <img> rather than next/image: these are arbitrary third-party hosts, and
 * next/image would need every one added to remotePatterns, so a newly ingested
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
      className="flex size-logo shrink-0 items-center justify-center overflow-hidden rounded-logo bg-surface-sunken"
      aria-hidden="true"
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          className="size-full object-contain p-tight"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-lead font-semibold leading-none text-content-secondary">
          {initial}
        </span>
      )}
    </span>
  );
}
