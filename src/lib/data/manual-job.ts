import { getServerClient } from "@/lib/supabase/server";
import {
  identifyPosting,
  postingIdCandidates,
  fetchAtsPosting,
  parsePostingPage,
  identifyCompany,
  normaliseWebsite,
  guessCompanyWebsite,
} from "@/ingest/manual";
import { resolveLogo, FLOOR_PX } from "@/ingest/logo";
import { ingestEnv } from "@/lib/env";
import { contentHash } from "@/ingest/normalize";
import { parseLocation } from "@/ingest/location";
import type { NormalizedJob } from "@/ingest/types";

/**
 * Turning a pasted link into a job row, reusing one wherever possible.
 *
 * The order matters more than any single step. Four things are tried and the
 * first that answers wins, cheapest and most exact first:
 *
 *   1. The URL already on a job. A link to something the feed carries should
 *      not create a second copy of it — it should hand back the row that
 *      exists, with whatever save, application and history it already has.
 *   2. A posting id pulled out of the URL. Companies serve Greenhouse boards
 *      from their own domain, so `?gh_jid=7194969` is a link to an ingested job
 *      wearing an unfamiliar hostname. Same outcome as 1.
 *   3. A recognisable board URL. Fetched from the same API and run through the
 *      same parser the ingester uses, so the new row is produced by identical
 *      code rather than merely resembling one.
 *   4. Anything else. The page is read and extracted, and the row is marked
 *      source 'manual'.
 *
 * Steps 1 and 2 are why this is not simply "insert what the user pasted": with
 * 17,000 postings already ingested, a good share of links point at rows that
 * are already here.
 */

export type ManualResolution =
  | { outcome: "existing"; jobId: string; title: string; companyName: string }
  | { outcome: "created"; jobId: string; title: string; companyName: string; via: "board" | "page" };

/**
 * Writes the posting, and the company if it is a new one.
 *
 * Everything goes through add_manual_job rather than two inserts from here.
 * companies and jobs are ingestion-owned globals the app user cannot write —
 * check:rls asserts that, and an eslint rule keeps the service client out of
 * src/ — so the escalation lives in one security definer function where it can
 * be read in full, instead of in a route handler holding the secret key.
 *
 * The function is also what makes a race harmless: it returns the existing job
 * id when one already matches, so a board pull landing mid-request, or the same
 * link pasted twice, produces one row either way.
 */
async function writeJob(
  companyName: string,
  source: "greenhouse" | "ashby" | "lever" | "manual",
  job: NormalizedJob,
  identity: { website: string | null; logo: string | null } = { website: null, logo: null },
): Promise<string> {
  const db = await getServerClient();
  const location = parseLocation(job.locationRaw);

  const { data, error } = await db.rpc("add_manual_job", {
    p_company_name: companyName,
    p_source: source,
    // Omitted rather than null: PostgREST types a defaulted argument as
    // `T | undefined`, and an absent one takes the function's own default,
    // which is the same null this would otherwise spell out.
    p_company_website: identity.website ?? undefined,
    p_company_logo: identity.logo ?? undefined,
    p_job: {
      source_job_id: job.sourceJobId,
      url: job.url,
      title: job.title,
      department: job.department,
      team: job.team,
      employment_type: job.employmentType,
      location_raw: job.locationRaw,
      location_cities: location.cities,
      location_countries: location.countries,
      us_eligible: location.usEligible,
      remote_policy: job.remotePolicy,
      comp_min: job.compMin,
      comp_max: job.compMax,
      comp_currency: job.compCurrency,
      comp_period: job.compPeriod,
      comp_source: job.compSource,
      comp_note: job.compNote,
      years_min: job.yearsMin,
      years_max: job.yearsMax,
      years_source: job.yearsSource,
      description_html: job.descriptionHtml,
      description_text: job.descriptionText,
      posted_at: job.postedAt,
      content_hash: contentHash(job),
      raw: job.raw ?? {},
    } as never,
  });
  if (error) throw new Error(`Could not save the job: ${error.message}`);
  return data as unknown as string;
}

/**
 * The company's logo, from the company's own site.
 *
 * Runs before the row is written rather than after, because the write is a
 * single security definer call and a second privileged round trip to attach a
 * logo would be a second surface to reason about. It is also the only chance:
 * scripts/logos.ts and the ingest logo step both select on
 * `website_url is not null`, and until this ran there was nothing for either to
 * find, so a hand-added company would have shown a monogram forever.
 *
 * Never fatal. A posting that could not be given a logo is still a posting, and
 * the monogram it falls back to is a designed state.
 */
async function logoFor(website: string | null): Promise<string | null> {
  if (!website) return null;
  try {
    const { userAgent } = ingestEnv();
    const logo = await resolveLogo(website, userAgent);
    // Same floor the bulk resolver uses: below it, the monogram is crisper than
    // a 16px favicon stretched across the tile.
    return logo && logo.width >= FLOOR_PX ? logo.href : null;
  } catch {
    return null;
  }
}

export async function resolveManualJob(rawUrl: string): Promise<ManualResolution> {
  const url = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That does not look like a link. Paste the full URL, including https://");
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Only http and https links can be added.");
  }

  const db = await getServerClient();

  // 1. Already here, by URL.
  const { data: byUrl } = await db
    .from("jobs")
    .select("id, title, companies(name)")
    .eq("url", url)
    .limit(1)
    .maybeSingle();
  if (byUrl) {
    return {
      outcome: "existing",
      jobId: byUrl.id,
      title: byUrl.title,
      companyName: (byUrl.companies as { name: string } | null)?.name ?? "Unknown",
    };
  }

  // 2. Already here, by a posting id carried in the URL.
  const candidates = postingIdCandidates(url);
  if (candidates.length > 0) {
    const { data: byId } = await db
      .from("jobs")
      .select("id, title, companies(name)")
      .in("source_job_id", candidates)
      .limit(1)
      .maybeSingle();
    if (byId) {
      return {
        outcome: "existing",
        jobId: byId.id,
        title: byId.title,
        companyName: (byId.companies as { name: string } | null)?.name ?? "Unknown",
      };
    }
  }

  // 3. A board we can ask directly.
  const identified = identifyPosting(url);
  if (identified) {
    const fetched = await fetchAtsPosting(identified);
    if (fetched) {
      // The board is usually already in companies under its ats_slug, so the
      // posting joins the company it actually belongs to. add_manual_job
      // refuses a board source with no such company rather than minting a fake
      // one, so a genuinely unknown board falls through to the page reader
      // below and lands as a manual row.
      const { data: board } = await db
        .from("companies")
        .select("name")
        .eq("ats_source", identified.source)
        .eq("ats_slug", identified.boardSlug)
        .maybeSingle();

      if (board) {
        const jobId = await writeJob(board.name, identified.source, fetched.job);
        return {
          outcome: "created",
          jobId,
          title: fetched.job.title,
          companyName: board.name,
          via: "board",
        };
      }

      // Known board, unknown company. The posting is exactly what the board
      // published — same fetch, same parser — so only the source label differs,
      // and that difference is honest: nothing here resolved a board.
      //
      // The name is the part the board cannot be trusted for. Greenhouse
      // returns company_name and that is authoritative; Ashby and Lever return
      // nothing, and the slug is not a name — it would put "ramp" on a card
      // that should read "Ramp", and "weights-and-biases" on one that should
      // read "Weights & Biases". So the description is read for the real one.
      const identity = fetched.companyName
        ? { name: fetched.companyName, website: null as string | null }
        : await identifyCompany(fetched.job.descriptionText, identified.boardSlug);

      const name = identity.name ?? identified.boardSlug;
      // Boards name a company but never link to it, so a probe is usually the
      // only route to a logo for one monadic has not seen before.
      const website =
        normaliseWebsite(identity.website) ??
        (identity.name ? await guessCompanyWebsite(identity.name, ingestEnv().userAgent) : null);
      const jobId = await writeJob(name, "manual", fetched.job, {
        website,
        logo: await logoFor(website),
      });
      return { outcome: "created", jobId, title: fetched.job.title, companyName: name, via: "board" };
    }
  }

  // 4. Read the page.
  const page = await parsePostingPage(url);
  if (!page) {
    throw new Error(
      "That page could not be read as a job posting. It may need a login, or it may be a list of roles rather than one role.",
    );
  }

  // The hostname is the last resort and only when it is not a job board's —
  // deriving a company from boards.greenhouse.io would name it "greenhouse"
  // and point the logo resolver at Greenhouse's own mark.
  const fallbackHost = normaliseWebsite(parsed.hostname);
  const name =
    page.companyName ?? (fallbackHost ? parsed.hostname.replace(/^www\./, "") : "Unknown company");
  const website = page.companyWebsite ?? fallbackHost;
  const jobId = await writeJob(name, "manual", page.job, {
    website,
    logo: await logoFor(website),
  });
  return { outcome: "created", jobId, title: page.job.title, companyName: name, via: "page" };
}
