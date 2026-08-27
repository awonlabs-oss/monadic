import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Resolving a company's logo from that company's own website.
 *
 * Deliberately not a logo API. Clearbit and its equivalents are paid data
 * providers, which the brief rules out, and they would also mean handing a
 * third party the list of companies being tracked. Everything here comes from
 * the company's own site.
 *
 * This lives here rather than in scripts/logos.ts because two callers need it:
 * the bulk script, and ingest — which fills in anything missing on every run so
 * a newly-seeded company has its logo by the time its roles first appear. A
 * company added to the seed list should never need a second manual command
 * before its cards look right.
 *
 * The resolved URL is stored, not the bytes — see the note in the README about
 * self-hosting these later.
 */

interface Candidate {
  href: string;
  /** Declared size, used only to order the fetch queue. Never trusted as fact. */
  declared: number;
  vector: boolean;
}

/** Below this an icon is soft in a 68px tile, and worth flagging in the output. */
export const MIN_PX = 64;

/**
 * Below this it is not worth storing at all.
 *
 * A 16px favicon upscaled onto a 68px tile is four times its own size and reads
 * as a blocky smear. The monogram is a designed state and is crisp, so it wins.
 * 32px survives because it is soft rather than unusable, and a recognisable
 * logo still beats a letter.
 */
export const FLOOR_PX = 32;

/**
 * Real pixel dimensions, read from the file's own header.
 *
 * The declared `sizes` attribute is a claim, not a measurement, and it is
 * frequently absent or wrong. Measuring cost 13 of 93 companies a blurry tile:
 * each had a 16, 32 or 48px favicon that the resolver accepted because nothing
 * bigger was declared.
 */
function pixelWidth(buf: Buffer, contentType: string): number | null {
  if (contentType.includes("svg") || buf.subarray(0, 400).toString().includes("<svg")) {
    return Number.POSITIVE_INFINITY; // vector, sharp at any size
  }
  if (buf.length > 24 && buf.subarray(1, 4).toString() === "PNG") return buf.readUInt32BE(16);
  if (buf.length > 8 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01) {
    // ICO directory: byte 6 is the width, 0 meaning 256.
    return buf[6] === 0 ? 256 : buf[6];
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return buf.readUInt16BE(i + 7);
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (buf.length > 30 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") {
    if (buf.subarray(12, 16).toString() === "VP8X") return 1 + buf.readUIntLE(24, 3);
    if (buf.subarray(12, 16).toString() === "VP8 ") return buf.readUInt16LE(26) & 0x3fff;
    return null;
  }
  if (buf.length > 10 && buf.subarray(0, 3).toString() === "GIF") return buf.readUInt16LE(6);
  return null;
}

/** Parse <link rel="...icon..."> tags. */
function iconCandidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = [];

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!rel || !/icon/.test(rel)) continue;

    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;

    const sizes = /sizes\s*=\s*["'](\d+)x\d+["']/i.exec(tag)?.[1];
    const vector = /\.svg($|\?)/i.test(href) || /image\/svg/i.test(tag);
    let declared = sizes ? Number(sizes) : 0;
    if (!declared && rel.includes("apple-touch")) declared = 180;

    try {
      out.push({ href: new URL(href, base).toString(), declared, vector });
    } catch {
      // Malformed href in someone's markup is not worth failing over.
    }
  }
  return out;
}

/**
 * Icons declared in the web app manifest.
 *
 * This is where the large art lives — a manifest routinely declares 192px and
 * 512px versions — and the old resolver never looked, which is most of why it
 * settled for favicons.
 */
async function manifestCandidates(
  html: string,
  base: string,
  userAgent: string,
): Promise<Candidate[]> {
  const tag = (html.match(/<link\b[^>]*>/gi) ?? []).find((t) =>
    /rel\s*=\s*["'][^"']*manifest/i.test(t),
  );
  const href = tag ? /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] : null;
  if (!href) return [];

  try {
    const url = new URL(href, base).toString();
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!response.ok) return [];

    const manifest = JSON.parse(await response.text()) as {
      icons?: Array<{ src?: string; sizes?: string; type?: string }>;
    };
    return (manifest.icons ?? [])
      .filter((icon) => icon.src)
      .map((icon) => ({
        href: new URL(icon.src as string, url).toString(),
        declared: Math.max(
          0,
          ...(icon.sizes ?? "").split(/\s+/).map((s) => Number(s.split("x")[0]) || 0),
        ),
        vector: /svg/i.test(icon.type ?? "") || /\.svg($|\?)/i.test(icon.src as string),
      }));
  } catch {
    return [];
  }
}

/** Fetches a candidate and returns its real width, or null if it is not an image. */
async function measure(
  url: string,
  userAgent: string,
): Promise<number | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: "image/*,*/*" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length === 0) return null;
    if (!contentType.startsWith("image/") && !contentType.includes("svg")) return null;
    return pixelWidth(buf, contentType);
  } catch {
    return null;
  }
}

/**
 * The best icon a company publishes about itself, measured rather than trusted.
 *
 * Still not a logo API — Clearbit and its equivalents are paid data providers,
 * which the brief rules out, and using one would mean handing a third party the
 * list of companies being tracked. Everything here comes from the company's own
 * site.
 *
 * Every candidate is fetched and measured, and the widest wins, with vectors
 * ranked above every raster because they are sharp at any size. A sub-64px icon
 * is accepted only when it is the only thing that exists, because a monogram
 * beats a blurry one.
 */
export async function resolveLogo(
  site: string,
  userAgent: string,
): Promise<{ href: string; width: number } | null> {
  const base = site.startsWith("http") ? site : `https://${site}`;

  let html = "";
  try {
    const response = await fetch(base, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    if (response.ok) html = await response.text();
  } catch {
    // Fall through to the conventional paths below.
  }

  const candidates = [
    ...iconCandidates(html, base),
    ...(await manifestCandidates(html, base, userAgent)),
    ...["/apple-touch-icon.png", "/icon.svg", "/favicon.svg", "/favicon.ico"].map((path) => {
      try {
        return { href: new URL(path, base).toString(), declared: 0, vector: path.endsWith(".svg") };
      } catch {
        return null;
      }
    }).filter((c): c is Candidate => c !== null),
  ];

  // Deduplicated, and ordered so the most promising is measured first. The
  // order is a hint only: every one is still measured before anything wins.
  const seen = new Set<string>();
  const queue = candidates
    .filter((c) => (seen.has(c.href) ? false : (seen.add(c.href), true)))
    .sort((a, b) => Number(b.vector) - Number(a.vector) || b.declared - a.declared);

  let best: { href: string; width: number } | null = null;
  for (const candidate of queue) {
    const width = await measure(candidate.href, userAgent);
    if (width === null) continue;
    if (!best || width > best.width) best = { href: candidate.href, width };
    // Nothing beats a vector, so there is no reason to keep fetching.
    if (best.width === Number.POSITIVE_INFINITY) break;
  }
  return best;
}

export interface LogoSyncResult {
  /** "found" also covers a vector, which measures as infinite width. */
  outcome: "found" | "too_small" | "none";
  width: number | null;
  href: string | null;
}

/**
 * Resolves one company's logo and writes the result.
 *
 * A width below FLOOR_PX is written as null rather than skipped. That matters
 * for the --force path in scripts/logos.ts: without an explicit clear, a bad
 * resolution from an earlier run could never be undone. It also means a
 * company whose only icon is a 16px favicon stays null and is retried next
 * run, which is the correct trade — retrying costs one request, and the
 * monogram it falls back to is a designed state rather than a hole.
 */
export async function syncCompanyLogo(
  db: SupabaseClient<Database>,
  company: { id: string; slug: string; website_url: string },
  userAgent: string,
): Promise<LogoSyncResult> {
  const logo = await resolveLogo(company.website_url, userAgent);

  if (logo && logo.width < FLOOR_PX) {
    const { error } = await db
      .from("companies")
      .update({ logo_url: null })
      .eq("id", company.id);
    if (error) throw new Error(`${company.slug}: ${error.message}`);
    return { outcome: "too_small", width: logo.width, href: logo.href };
  }

  if (logo) {
    const { error } = await db
      .from("companies")
      .update({ logo_url: logo.href })
      .eq("id", company.id);
    if (error) throw new Error(`${company.slug}: ${error.message}`);
    return { outcome: "found", width: logo.width, href: logo.href };
  }

  return { outcome: "none", width: null, href: null };
}
