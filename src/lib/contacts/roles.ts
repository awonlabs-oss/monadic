/**
 * Contact relationship vocabulary, with no server imports.
 *
 * This is separate from lib/data/contacts.ts for one concrete reason: the form
 * and the list are client components and need these labels, and importing them
 * from the data module pulled getServerClient — and through it node:fs — into
 * the client bundle. The build failed with "the chunking context does not
 * support external modules (request: node:fs)", which names the symptom rather
 * than the cause.
 *
 * A type-only import would have been erased and caused nothing. These are
 * values, so the whole module came with them. Constants that both sides need
 * live here; anything that touches the database stays in the data module.
 */

export const CONTACT_ROLES = [
  "recruiter",
  "hiring_manager",
  "referral",
  "interviewer",
  "other",
] as const;

export type ContactRole = (typeof CONTACT_ROLES)[number];

export const ROLE_LABELS: Record<ContactRole, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  referral: "Referral",
  interviewer: "Interviewer",
  other: "Other",
};
