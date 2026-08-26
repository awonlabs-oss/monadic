import type { EducationRow, ExperienceRow, ProfileRow } from "@/lib/data/profile";

/**
 * Which parsed fields the parse itself could not settle.
 *
 * The dock frame (22:471) shows an amber "N parsed fields need review" banner
 * and outlines the offending entries. There is no confidence score in the
 * schema and inventing one would be fiction, so the flags below are derived
 * from something the parser already tells us honestly: it was instructed to
 * emit null rather than guess, and it keeps the original wording in
 * `*_text` alongside the normalised `*_date`.
 *
 * That gives one genuinely diagnostic signal — a row where the resume clearly
 * said something (`start_text` is present) but normalisation produced nothing
 * (`start_date` is null) is a date the parser could not read. It is exactly the
 * case worth surfacing, and it is a fact rather than a guess.
 *
 * Only `source = 'parsed'` rows are checked. A row typed by hand is the user's
 * own statement and is not the parser's to second-guess.
 */

export interface Flag {
  /** Shown inline on the entry, beside its date line. */
  note: string;
}

export function flagExperience(row: ExperienceRow): Flag | null {
  if (row.source !== "parsed") return null;

  if (row.title === null) return { note: "Check title" };

  // The resume stated a date and it did not normalise.
  if (row.start_text !== null && row.start_date === null) return { note: "Check dates" };
  if (!row.is_current && row.end_text !== null && row.end_date === null) {
    return { note: "Check dates" };
  }
  // No date at all, current or not: the role has no position on a timeline.
  if (row.start_text === null && row.start_date === null) return { note: "No dates" };

  return null;
}

export function flagEducation(row: EducationRow): Flag | null {
  if (row.source !== "parsed") return null;
  if (row.end_year === null && row.start_year === null) return { note: "No dates" };
  if (row.degree === null && row.field === null) return { note: "Check degree" };
  return null;
}

/**
 * Profile-level gaps, counted into the banner but with no entry to outline.
 * Contact details are what outreach will need, so an absent one is worth the
 * count even though there is nowhere to put a badge yet.
 */
export function profileGaps(profile: ProfileRow | null): number {
  if (!profile) return 0;
  return [profile.full_name, profile.email, profile.location].filter((v) => v === null).length;
}

export function reviewCount(
  profile: ProfileRow | null,
  experiences: ExperienceRow[],
  education: EducationRow[],
): number {
  return (
    profileGaps(profile) +
    experiences.filter((r) => flagExperience(r) !== null).length +
    education.filter((r) => flagEducation(r) !== null).length
  );
}
