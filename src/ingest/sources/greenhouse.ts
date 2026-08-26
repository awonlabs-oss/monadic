import type { JobSource, NormalizedJob } from "../types";
import {
  compFromDescription,
  remotePolicyFrom,
  stripHtml,
  yearsFromDescription,
} from "../normalize";

/**
 * Greenhouse job boards API.
 *
 * Verified against a live board while writing this. Two things worth knowing:
 *
 *  - There is no structured compensation anywhere in the response. Not a
 *    nullable field that happened to be empty — the endpoint does not carry
 *    one. Every Greenhouse comp figure in this database is therefore parsed out
 *    of description prose and marked compSource = "description".
 *  - `location.name` is free text and frequently multi-valued, e.g.
 *    "New York City, NY; San Francisco, CA | New York City, NY". It is stored
 *    verbatim; parsing it into city/region is not attempted here.
 *
 * `content` is HTML-escaped HTML, so it needs unescaping before tag stripping.
 */

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url?: string | null;
  content?: string | null;
  location?: { name?: string | null } | null;
  departments?: Array<{ name?: string | null; parent_id?: number | null }> | null;
  offices?: Array<{ name?: string | null; location?: string | null }> | null;
  metadata?: Array<{ name?: string | null; value?: unknown }> | null;
  updated_at?: string | null;
  first_published?: string | null;
}

interface GreenhouseBoard {
  jobs?: GreenhouseJob[];
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Greenhouse boards carry arbitrary custom fields; this is where "Location Type" lives. */
function metadataValue(job: GreenhouseJob, name: RegExp): string | null {
  const hit = job.metadata?.find((m) => m.name && name.test(m.name));
  if (!hit || hit.value == null) return null;
  return typeof hit.value === "string" ? hit.value : String(hit.value);
}

export const greenhouse: JobSource = {
  source: "greenhouse",

  boardUrl(slug) {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  },

  isRealBoard(payload) {
    return Array.isArray((payload as GreenhouseBoard | null)?.jobs);
  },

  parse(payload) {
    const jobs = (payload as GreenhouseBoard | null)?.jobs ?? [];

    return jobs.map((job): NormalizedJob => {
      const html = job.content ? unescapeHtml(job.content) : null;
      const text = stripHtml(html);
      const locationRaw = job.location?.name?.trim() || null;
      const locationType = metadataValue(job, /location\s*type|remote|work\s*model/i);

      return {
        sourceJobId: String(job.id),
        title: job.title?.trim() || "(untitled)",
        url: job.absolute_url ?? null,

        // Greenhouse nests departments; the top-level one is the useful label.
        department: job.departments?.find((d) => !d.parent_id)?.name?.trim() ?? null,
        team: null,
        employmentType: null,

        locationRaw,
        remotePolicy: remotePolicyFrom(locationType, locationRaw),

        // No structured comp exists on this endpoint. Prose is all there is.
        ...compFromDescription(text),
        ...yearsFromDescription(text),

        descriptionHtml: html,
        descriptionText: text,

        postedAt: job.first_published ?? job.updated_at ?? null,

        raw: job,
      };
    });
  },
};
