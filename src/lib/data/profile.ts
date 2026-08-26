import { getServerClient } from "@/lib/supabase/server";
import type { ParsedResume } from "@/profile/schema";

/**
 * Reads and writes the parsed resume.
 *
 * The parse lands in four tables — profiles, profile_experiences,
 * profile_skills, profile_education — rather than one JSONB blob, because both
 * things that will consume it want rows: the editing UI needs per-row identity
 * to correct and reorder, and scoring later wants set operations over skills.
 * profiles.raw still holds the untouched parser output, so the projection never
 * loses anything the model produced.
 */

export interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: Record<string, string | null>;
  headline: string | null;
  summary: string | null;
  years_experience_total: number | null;
  seniority_signal: string | null;
  source_file_name: string | null;
  source_file_type: string | null;
  parsed_at: string | null;
  parser_version: string | null;
}

export interface ExperienceRow {
  id: string;
  company_name: string;
  title: string | null;
  location: string | null;
  start_date: string | null;
  start_text: string | null;
  end_date: string | null;
  end_text: string | null;
  is_current: boolean;
  seniority: string | null;
  description: string | null;
  sort_order: number;
  source: string;
}

export interface SkillRow {
  id: string;
  name: string;
  category: string | null;
  years: number | null;
  source: string;
}

export interface EducationRow {
  id: string;
  institution: string;
  degree: string | null;
  field: string | null;
  start_year: number | null;
  end_year: number | null;
  notes: string | null;
  sort_order: number;
  source: string;
}

export interface FullProfile {
  profile: ProfileRow | null;
  experiences: ExperienceRow[];
  skills: SkillRow[];
  education: EducationRow[];
}

export async function getProfile(): Promise<FullProfile> {
  const db = await getServerClient();

  const { data: profile, error } = await db
    .from("profiles")
    .select(
      "id,user_id,full_name,email,phone,location,links,headline,summary,years_experience_total,seniority_signal,source_file_name,source_file_type,parsed_at,parser_version",
    )
    .maybeSingle();
  if (error) throw new Error(`getProfile: ${error.message}`);

  if (!profile) return { profile: null, experiences: [], skills: [], education: [] };

  const [experiences, skills, education] = await Promise.all([
    db
      .from("profile_experiences")
      .select(
        "id,company_name,title,location,start_date,start_text,end_date,end_text,is_current,seniority,description,sort_order,source",
      )
      .eq("profile_id", profile.id)
      .order("sort_order"),
    db
      .from("profile_skills")
      .select("id,name,category,years,source")
      .eq("profile_id", profile.id)
      .order("name"),
    db
      .from("profile_education")
      .select("id,institution,degree,field,start_year,end_year,notes,sort_order,source")
      .eq("profile_id", profile.id)
      .order("sort_order"),
  ]);

  return {
    profile: profile as unknown as ProfileRow,
    experiences: (experiences.data ?? []) as unknown as ExperienceRow[],
    skills: (skills.data ?? []) as unknown as SkillRow[],
    education: (education.data ?? []) as unknown as EducationRow[],
  };
}

/**
 * Replaces the parsed profile with a fresh parse.
 *
 * Deliberately destructive for parsed rows and deliberately not for manual ones:
 * re-uploading a resume replaces what the parser produced, but anything you
 * typed by hand survives. Without that split, one re-upload silently discards
 * every correction you made to the last parse — and the brief is explicit that
 * parsing will be imperfect and correcting it is the normal case.
 */
export async function replaceParsedProfile(
  parsed: ParsedResume,
  source: { filename: string; fileType: string; parserId: string },
): Promise<void> {
  const db = await getServerClient();
  const { data: user } = await db.auth.getUser();
  const userId = user.user?.id;
  if (!userId) throw new Error("not signed in");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        full_name: parsed.fullName,
        email: parsed.email,
        phone: parsed.phone,
        location: parsed.location,
        links: parsed.links as never,
        headline: parsed.headline,
        summary: parsed.summary,
        years_experience_total: parsed.yearsExperienceTotal,
        seniority_signal: parsed.senioritySignal,
        source_file_name: source.filename,
        source_file_type: source.fileType,
        parsed_at: new Date().toISOString(),
        parser_version: source.parserId,
        raw: parsed as never,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  const profileId = profile.id;

  for (const table of ["profile_experiences", "profile_skills", "profile_education"] as const) {
    const { error } = await db
      .from(table)
      .delete()
      .eq("profile_id", profileId)
      .eq("source", "parsed");
    if (error) throw new Error(`${table} clear: ${error.message}`);
  }

  if (parsed.experiences.length > 0) {
    const { error } = await db.from("profile_experiences").insert(
      parsed.experiences.map((e, i) => ({
        user_id: userId,
        profile_id: profileId,
        company_name: e.company,
        title: e.title,
        location: e.location,
        start_date: e.startDate,
        start_text: e.startText,
        end_date: e.endDate,
        end_text: e.endText,
        is_current: e.isCurrent,
        seniority: e.seniority,
        description: e.summary,
        sort_order: i,
        source: "parsed",
        raw: e as never,
      })),
    );
    if (error) throw new Error(`experiences: ${error.message}`);
  }

  if (parsed.education.length > 0) {
    const { error } = await db.from("profile_education").insert(
      parsed.education.map((e, i) => ({
        user_id: userId,
        profile_id: profileId,
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        start_year: e.startYear,
        end_year: e.endYear,
        notes: e.notes,
        sort_order: i,
        source: "parsed",
        raw: e as never,
      })),
    );
    if (error) throw new Error(`education: ${error.message}`);
  }

  if (parsed.skills.length > 0) {
    // The unique index is on lower(name), so a resume listing the same skill in
    // two sections would otherwise fail the whole insert.
    const seen = new Set<string>();
    const rows = parsed.skills
      .filter((s) => {
        const key = s.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((s) => ({
        user_id: userId,
        profile_id: profileId,
        name: s.name.trim(),
        category: s.category,
        source: "parsed",
      }));

    if (rows.length > 0) {
      const { error } = await db.from("profile_skills").insert(rows);
      if (error) throw new Error(`skills: ${error.message}`);
    }
  }
}
