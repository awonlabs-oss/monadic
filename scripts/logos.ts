/**
 * Resolves each company's logo from that company's own website.
 *
 *   npm run logos            fill in anything missing
 *   npm run logos -- --force redo every company
 *
 * Deliberately not a logo API. Clearbit and its equivalents are paid data
 * providers, which the brief rules out, and they would also mean handing a third
 * party the list of companies being tracked.
 *
 * Preference order is largest-first: apple-touch-icon is typically 180px and
 * looks right at card size, whereas /favicon.ico is often 16px and renders as
 * mush. The resolved URL is stored, not the bytes — see the note in the README
 * about self-hosting these later.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { ingestEnv } from "@/lib/env";

const force = process.argv.includes("--force");

interface Candidate {
  href: string;
  size: number;
}

/** Parse <link rel="...icon..."> tags, preferring the largest declared size. */
function iconCandidates(html: string, base: string): Candidate[] {
  const out: Candidate[] = [];
  const linkRe = /<link\b[^>]*>/gi;

  for (const tag of html.match(linkRe) ?? []) {
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!rel || !/icon/.test(rel)) continue;

    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;

    const sizes = /sizes\s*=\s*["'](\d+)x\d+["']/i.exec(tag)?.[1];
    let size = sizes ? Number(sizes) : 0;
    // apple-touch-icon rarely declares a size but is reliably ~180px.
    if (!size && rel.includes("apple-touch")) size = 180;
    if (!size && /\.svg($|\?)/i.test(href)) size = 512; // vector scales cleanly

    try {
      out.push({ href: new URL(href, base).toString(), size });
    } catch {
      // Malformed href in someone's markup is not worth failing over.
    }
  }
  return out.sort((a, b) => b.size - a.size);
}

async function head(url: string, userAgent: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

async function resolveLogo(site: string, userAgent: string): Promise<string | null> {
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
    // Fall through to the conventional path below.
  }

  for (const candidate of iconCandidates(html, base)) {
    if (await head(candidate.href, userAgent)) return candidate.href;
  }

  // Nothing declared: try the two conventional locations before giving up.
  for (const path of ["/apple-touch-icon.png", "/favicon.ico"]) {
    const url = new URL(path, base).toString();
    if (await head(url, userAgent)) return url;
  }

  return null;
}

async function main() {
  const db = createServiceClient();
  const { userAgent } = ingestEnv();

  let query = db
    .from("companies")
    .select("id, name, slug, website_url, logo_url")
    .not("website_url", "is", null)
    .order("name");
  if (!force) query = query.is("logo_url", null);

  const { data: companies, error } = await query;
  if (error) throw new Error(error.message);

  if (!companies || companies.length === 0) {
    console.log("every company already has a logo. Use --force to redo them.");
    return;
  }

  console.log(`resolving logos for ${companies.length} companies\n`);
  let found = 0;

  for (const company of companies) {
    const logo = await resolveLogo(company.website_url as string, userAgent);

    if (logo) {
      found += 1;
      const { error: updateError } = await db
        .from("companies")
        .update({ logo_url: logo })
        .eq("id", company.id);
      if (updateError) throw new Error(`${company.slug}: ${updateError.message}`);
      console.log(`  ok      ${company.name.padEnd(14)} ${logo.slice(0, 76)}`);
    } else {
      // Not an error. The card falls back to a monogram, which is a designed
      // state rather than a hole.
      console.log(`  none    ${company.name.padEnd(14)} no icon found — monogram will be used`);
    }
  }

  console.log(`\n${found}/${companies.length} resolved`);
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
