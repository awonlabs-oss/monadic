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
 * `required`. Both are load-bearing: omitting a key from `required` is rejected
 * outright ("Schema is too complex"), and requiring all of them means a field
 * the resume does not mention comes back explicitly rather than absent, so the
 * caller never has to tell "not on the resume" from "the parser forgot".
 *
 * Absent text is the empty string, not null — the one place this schema does
 * not say what it means. Structured outputs cap a schema at 16 union-typed
 * parameters, and every field here being nullable put it at 25, so the request
 * was refused before the model ever saw it. Making the text fields plain
 * strings takes it to four unions: the two year integers, the total, and the
 * skill category.
 *
 * Nothing outside this module sees an empty string. `emptyToNull` below is
 * applied to every parse before it is returned, so ParsedResume means null the
 * way it always did, and the conflation of "absent" with "blank" costs nothing
 * because none of these fields has a meaningful empty-but-present value.
 */
export const RESUME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "fullName", "email", "phone", "location", "links", "headline", "summary",
    "yearsExperienceTotal", "senioritySignal", "experiences", "education", "skills",
  ],
  properties: {
    fullName: { type: "string", description: "Full name as written." },
    email: { type: "string" },
    phone: { type: "string" },
    location: { type: "string", description: "City and region as written." },
    links: {
      type: "object",
      additionalProperties: false,
      required: ["linkedin", "github", "portfolio"],
      properties: {
        linkedin: { type: "string" },
        github: { type: "string" },
        portfolio: { type: "string" },
      },
    },
    headline: {
      type: "string",
      description: "The one-line title under the name, if there is one. Not invented.",
    },
    summary: {
      type: "string",
      description:
        "The resume's own summary or objective paragraph, verbatim. Empty string if absent.",
    },
    yearsExperienceTotal: {
      type: ["number", "null"],
      description:
        "Total professional years, computed from the role dates. Null when the dates do not support a figure.",
    },
    senioritySignal: {
      type: "string",
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
          title: { type: "string" },
          location: { type: "string" },
          startDate: {
            type: "string",
            description:
              "ISO 8601 date. Use the first of the month when only a month is given, the first of January when only a year is.",
          },
          startText: { type: "string", description: "The date exactly as written." },
          endDate: { type: "string" },
          endText: { type: "string" },
          isCurrent: { type: "boolean" },
          seniority: { type: "string" },
          summary: {
            type: "string",
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
          degree: { type: "string" },
          field: { type: "string" },
          startYear: { type: ["integer", "null"] },
          endYear: { type: ["integer", "null"] },
          notes: { type: "string" },
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
          /*
           * anyOf rather than a union type carrying a nullable enum.
           *
           * The API validates each enum member against the declared type, and a
           * union type fails that check outright — "Enum value 'language' does
           * not match declared type '['string', 'null']'" — whether or not null
           * is itself in the enum. So the two halves have to be expressed as
           * separate branches.
           *
           * Dropping the enum is the other way to make the request legal and it
           * is the wrong one: asked to categorise an unfamiliar skill without a
           * vocabulary, the model answers "Programming Language" where the rest
           * of the parse says "language", and the categories stop being a set
           * anything can group by.
           */
          category: {
            anyOf: [
              {
                type: "string",
                enum: ["language", "framework", "tool", "platform", "domain", "other"],
              },
              { type: "null" },
            ],
          },
        },
      },
    },
  },
} as const;

/**
 * Keys the schema declares as genuinely required strings. Everything else that
 * comes back blank means "not on the resume" and becomes null.
 *
 * A blank one of these is a broken row rather than an absent field, and it is
 * left as the empty string on purpose: the columns behind them are NOT NULL, so
 * nulling them would trade a visibly empty entry for a failed insert. There is
 * no key collision — `company` appears only on an experience, `institution`
 * only on an education, `name` only on a skill.
 */
const REQUIRED_STRINGS = new Set(["company", "institution", "name"]);

/**
 * Turns the wire representation into the documented one: blank text becomes
 * null, everywhere, at any depth.
 *
 * Trims on the way through, so a field padded to " " counts as absent too —
 * the model is being asked for a sentinel and " " is the same intent.
 */
export function emptyToNull<T>(value: T): T {
  if (typeof value === "string") {
    return (value.trim() === "" ? null : value.trim()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => emptyToNull(v)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] =
        REQUIRED_STRINGS.has(k) && typeof v === "string" ? v.trim() : emptyToNull(v);
    }
    return out as T;
  }
  return value;
}
