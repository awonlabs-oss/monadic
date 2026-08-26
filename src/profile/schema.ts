/**
 * The structured shape a resume is parsed into.
 *
 * This is the durable artifact, not display text. It is written as a JSON
 * Schema rather than a TypeScript type alone because the same object is handed
 * to the model as an output contract — the API constrains generation to it, so
 * the parse cannot come back malformed and there is no validation library in
 * the loop.
 *
 * Designed for the code that will consume it later — scoring wants set
 * operations over skills and date arithmetic over roles — so everything is a
 * field rather than a sentence. Every field except a role's company name is
 * nullable: resumes omit things, and a parser that invents a start date to
 * satisfy a required field is worse than one that admits it did not find one.
 */

export interface ParsedExperience {
  company: string;
  title: string | null;
  location: string | null;
  /** ISO date, normalised to the first of the month when only a month is given. */
  startDate: string | null;
  /** Exactly as written on the resume — "Jan 2021", "2021", "Present". */
  startText: string | null;
  endDate: string | null;
  endText: string | null;
  isCurrent: boolean;
  /** Level implied by the title, when the title implies one. */
  seniority: string | null;
  summary: string | null;
}

export interface ParsedEducation {
  institution: string;
  degree: string | null;
  field: string | null;
  startYear: number | null;
  endYear: number | null;
  notes: string | null;
}

export interface ParsedSkill {
  name: string;
  category: "language" | "framework" | "tool" | "platform" | "domain" | "other" | null;
}

export interface ParsedResume {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: { linkedin: string | null; github: string | null; portfolio: string | null };
  headline: string | null;
  summary: string | null;
  /** Total professional years, if the resume supports the inference. */
  yearsExperienceTotal: number | null;
  senioritySignal: string | null;
  experiences: ParsedExperience[];
  education: ParsedEducation[];
  skills: ParsedSkill[];
}

/**
 * The output contract handed to the model.
 *
 * Every object carries `additionalProperties: false` and lists every key in
 * `required` — structured outputs demand both, and it also means a field the
 * resume does not mention comes back explicitly null rather than absent, so the
 * caller never has to tell "not on the resume" from "the parser forgot".
 */
export const RESUME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "fullName", "email", "phone", "location", "links", "headline", "summary",
    "yearsExperienceTotal", "senioritySignal", "experiences", "education", "skills",
  ],
  properties: {
    fullName: { type: ["string", "null"], description: "Full name as written." },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    location: { type: ["string", "null"], description: "City and region as written." },
    links: {
      type: "object",
      additionalProperties: false,
      required: ["linkedin", "github", "portfolio"],
      properties: {
        linkedin: { type: ["string", "null"] },
        github: { type: ["string", "null"] },
        portfolio: { type: ["string", "null"] },
      },
    },
    headline: {
      type: ["string", "null"],
      description: "The one-line title under the name, if there is one. Not invented.",
    },
    summary: {
      type: ["string", "null"],
      description: "The resume's own summary or objective paragraph, verbatim. Null if absent.",
    },
    yearsExperienceTotal: {
      type: ["number", "null"],
      description:
        "Total professional years, computed from the role dates. Null when the dates do not support a figure.",
    },
    senioritySignal: {
      type: ["string", "null"],
      description: "Overall level the resume reads at, e.g. 'senior', 'staff', 'entry'.",
    },
    experiences: {
      type: "array",
      description: "Roles held, most recent first.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "company", "title", "location", "startDate", "startText",
          "endDate", "endText", "isCurrent", "seniority", "summary",
        ],
        properties: {
          company: { type: "string" },
          title: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          startDate: {
            type: ["string", "null"],
            description:
              "ISO 8601 date. Use the first of the month when only a month is given, the first of January when only a year is.",
          },
          startText: { type: ["string", "null"], description: "The date exactly as written." },
          endDate: { type: ["string", "null"] },
          endText: { type: ["string", "null"] },
          isCurrent: { type: "boolean" },
          seniority: { type: ["string", "null"] },
          summary: {
            type: ["string", "null"],
            description: "What the role involved, condensed from its bullets.",
          },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["institution", "degree", "field", "startYear", "endYear", "notes"],
        properties: {
          institution: { type: "string" },
          degree: { type: ["string", "null"] },
          field: { type: ["string", "null"] },
          startYear: { type: ["integer", "null"] },
          endYear: { type: ["integer", "null"] },
          notes: { type: ["string", "null"] },
        },
      },
    },
    skills: {
      type: "array",
      description:
        "Named skills, technologies and domains. One entry each — do not merge a list into a single string.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category"],
        properties: {
          name: { type: "string" },
          category: {
            type: ["string", "null"],
            enum: ["language", "framework", "tool", "platform", "domain", "other", null],
          },
        },
      },
    },
  },
} as const;
