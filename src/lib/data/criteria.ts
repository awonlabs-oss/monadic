import { getServerClient } from "@/lib/supabase/server";
import type { CriteriaRow, ExperienceRow, ProfileRow } from "@/lib/data/profile";
import { parseLocation } from "@/ingest/location";

/**
 * Writing criteria, and drafting them from a resume.
 *
 * Reading lives in data/profile.ts beside getCriteria, because the dock reads
 * both together. This module is the half that changes things.
 */

export interface CriteriaInput {
  targetRoleTypes: string[];
  locations: string[];
  remotePreference: string | null;
  yearsMin: number | null;
  yearsMax: number | null;
  compFloor: number | null;
  recencyDays: number;
}

export const REMOTE_PREFERENCES = [
  { key: "remote_only", label: "Remote only", policies: ["remote"] },
  { key: "remote_preferred", label: "Remote preferred", policies: ["remote", "hybrid"] },
  { key: "hybrid_ok", label: "Hybrid is fine", policies: ["hybrid", "onsite", "remote"] },
  { key: "onsite_ok", label: "On-site is fine", policies: ["onsite", "hybrid"] },
  { key: "any", label: "No preference", policies: [] },
] as const;

/**
 * The remote policies a preference is satisfied by.
 *
 * "No preference" returns nothing on purpose: an empty list makes the criterion
 * inapplicable in recommend_jobs, which is what having no preference means. It
 * is not the same as matching everything, because matching everything would
 * inflate every score by one.
 */
export function policiesFor(preference: string | null): string[] {
  if (!preference) return [];
  return [...(REMOTE_PREFERENCES.find((p) => p.key === preference)?.policies ?? [])];
}

export async function saveCriteria(input: CriteriaInput): Promise<void> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  const userId = user.user?.id;
  if (!userId) throw new Error("not signed in");

  const { error } = await db.from("search_criteria").upsert(
    {
      user_id: userId,
      target_role_types: input.targetRoleTypes,
      locations: input.locations,
      remote_preference: input.remotePreference,
      years_min: input.yearsMin,
      years_max: input.yearsMax,
      comp_floor: input.compFloor,
      recency_days: input.recencyDays,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`saveCriteria: ${error.message}`);
}

/**
 * Words that appear in a title without saying what the job is. Stripped so a
 * draft targets the role rather than the rung.
 */
const RUNG =
  /\b(senior|sr\.?|staff|principal|lead|junior|jr\.?|associate|intern|entry[- ]level|i{1,3}|iv|v)\b/gi;

/** Trailing qualifiers: "(Remote)", "- New York", ", Platform Team". */
const QUALIFIER = /\s*[([].*$|\s*[-–—,|].*$/;

function normaliseTitle(title: string): string {
  return title
    .replace(QUALIFIER, "")
    .replace(RUNG, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * A first draft of criteria, proposed from the parsed resume.
 *
 * Proposed, not applied — the same rule the parser follows. Everything here is
 * an inference from what you have done to what you want next, which is a leap
 * the resume does not actually make, so it lands in an editable form rather
 * than in the feed.
 *
 * Two fields are deliberately left blank. A resume states neither a pay floor
 * nor a willingness to relocate, and inventing either would put a number in the
 * feed that nothing supports.
 */
export function draftCriteria(
  profile: ProfileRow | null,
  experiences: ExperienceRow[],
): CriteriaInput {
  const titles = experiences
    .map((e) => e.title)
    .filter((t): t is string => Boolean(t))
    .map(normaliseTitle)
    .filter((t) => t.length > 2);

  // Most recent first, deduplicated, capped at three. Experiences already come
  // back in sort_order, which the parser fills most-recent-first.
  const roles: string[] = [];
  for (const title of titles) {
    if (!roles.includes(title)) roles.push(title);
    if (roles.length === 3) break;
  }

  // A band around what the resume supports rather than a single figure: the
  // point is which postings are open to you, and a posting asking for 2–4 years
  // is open to someone with 3. Downward by one because requirements are written
  // as ceilings you clear, upward by three because they are routinely inflated.
  const total = profile?.years_experience_total ?? null;
  const yearsMin = total === null ? null : Math.max(0, Math.floor(total) - 1);
  const yearsMax = total === null ? null : Math.floor(total) + 3;

  // Put through the same parser ingestion uses, not split on a comma.
  //
  // The two sides have to agree on spelling or the criterion matches nothing at
  // all, silently. A resume saying "New York City, NY" drafted the literal
  // string "New York City", and jobs.location_cities holds "New York" — 1,343
  // postings that would never have matched a criterion that looked correct on
  // screen. parseLocation is what wrote those values, so it is what has to read
  // this one.
  const locations = parseLocation(profile?.location ?? null).cities;

  return {
    targetRoleTypes: roles,
    locations,
    remotePreference: null,
    yearsMin,
    yearsMax,
    compFloor: null,
    recencyDays: 60,
  };
}

/** The draft, or what is already saved. Saved criteria always win. */
export function criteriaOrDraft(
  saved: CriteriaRow | null,
  profile: ProfileRow | null,
  experiences: ExperienceRow[],
): { input: CriteriaInput; isDraft: boolean } {
  if (saved) {
    return {
      isDraft: false,
      input: {
        targetRoleTypes: saved.target_role_types,
        locations: saved.locations,
        remotePreference: saved.remote_preference,
        yearsMin: saved.years_min,
        yearsMax: saved.years_max,
        compFloor: saved.comp_floor,
        recencyDays: saved.recency_days,
      },
    };
  }
  return { isDraft: true, input: draftCriteria(profile, experiences) };
}
