import type { Database } from "@/lib/supabase/types";

export type AtsSource = Database["public"]["Enums"]["ats_source"];

export type RemotePolicy = "remote" | "hybrid" | "onsite";
export type CompPeriod = "year" | "month" | "week" | "day" | "hour";
/** How we know a value. The schema refuses a figure that does not say. */
export type Provenance = "none" | "structured" | "description";

/**
 * One posting, in the shape the database wants, with `raw` still attached.
 *
 * Every field but sourceJobId and title is nullable, because across the three
 * ATSes every one of them is genuinely absent somewhere. Greenhouse returns no
 * structured compensation at all; Lever omits salaryRange on roughly a third of
 * postings; Ashby's location is a free-text string that may or may not name a
 * city. Modelling optimism here would only push the nulls into the UI wearing a
 * disguise.
 */
export interface NormalizedJob {
  sourceJobId: string;
  title: string;
  url: string | null;

  department: string | null;
  team: string | null;
  employmentType: string | null;

  locationRaw: string | null;
  remotePolicy: RemotePolicy | null;

  compMin: number | null;
  compMax: number | null;
  compCurrency: string | null;
  compPeriod: CompPeriod | null;
  compSource: Provenance;
  compNote: string | null;

  yearsMin: number | null;
  yearsMax: number | null;
  yearsSource: Provenance;

  descriptionHtml: string | null;
  descriptionText: string | null;

  postedAt: string | null;

  /** The untouched entry from the board response. Source of truth. */
  raw: unknown;
}

/**
 * A board reader. Implementations know their ATS's response shape and nothing
 * about the database — persist.ts owns that side, and cannot fetch. The split
 * is what keeps "a failed fetch must never close a job" checkable: closure
 * lives entirely on the persist side of the line.
 */
export interface JobSource {
  readonly source: AtsSource;

  /** The JSON endpoint for a board. */
  boardUrl(slug: string): string;

  /**
   * Whether a board response means "this slug exists here". Used by the
   * resolver, which cannot rely on status alone — some ATSes answer 200 with an
   * empty body for an unknown slug.
   */
  isRealBoard(payload: unknown): boolean;

  parse(payload: unknown): NormalizedJob[];
}

export const emptyComp = {
  compMin: null,
  compMax: null,
  compCurrency: null,
  compPeriod: null,
  compSource: "none",
  compNote: null,
} satisfies Pick<
  NormalizedJob,
  "compMin" | "compMax" | "compCurrency" | "compPeriod" | "compSource" | "compNote"
>;

export const emptyYears = {
  yearsMin: null,
  yearsMax: null,
  yearsSource: "none",
} satisfies Pick<NormalizedJob, "yearsMin" | "yearsMax" | "yearsSource">;
