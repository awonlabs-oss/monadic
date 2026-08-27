"use client";

import { useState } from "react";

/**
 * CompanyPreview tile. Figma node 12:142 inside JobCardWide.
 *
 * A 68px square with a 7px radius, filled by the logo via object-cover.
 *
 * There is no tile behind a real logo — no grey fill and no outline. Almost
 * every one of these is a transparent PNG, and a large share are a circular or
 * rounded mark on that transparency, so a filled square behind them showed as
 * grey corners around a circle: a second shape the company never designed,
 * fighting the card it sits on. On the card's own white the transparency simply
 * disappears and the mark reads as the mark.
 *
 * The cost is that a near-white logo has less to sit against. That is the
 * trade being made deliberately: it affects a handful of companies, where the
 * grey corners affected every circular logo in the feed.
 *
 * object-cover rather than contain: measured across the 110 companies that have
 * one, every logo whose dimensions can be read is exactly square (61 of 61), so
 * cover crops nothing in practice and letterboxing would only reintroduce the
 * empty margin this change exists to remove.
 *
 * The monogram fallback keeps the filled tile, because there it is the whole
 * design rather than a backdrop — and it is a designed fallback, not an error
 * state: the URL is resolved from the company's own site, so it can 404 or
 * change format, and a letter tile reads as intentional where a broken-image
 * glyph reads as broken.
 *
 * Plain <img> rather than next/image because these are arbitrary third-party
 * hosts; next/image would need each one in remotePatterns, so a newly ingested
 * company would silently fail to render until config caught up.
 */
export function CompanyLogo({
  name,
  src,
  size = "default",
}: {
  name: string;
  src: string | null;
  /**
   * `small` is the 34px tile a rail panel uses, `card` the 44px feed tile, and
   * `default` the 68px one the detail page header keeps.
   */
  size?: "default" | "card" | "small";
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase();
  const hasImage = Boolean(src) && !failed;
  const small = size === "small";
  const tile =
    size === "small" ? "size-logo-sm" : size === "card" ? "size-logo-card" : "size-logo";

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-preview ${
        tile
      } ${hasImage ? "" : "border border-border-subtle bg-surface-sunken"}`}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`font-semibold leading-none tracking-mid text-content-primary ${
            small || size === "card" ? "text-body" : "text-monogram"
          }`}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
