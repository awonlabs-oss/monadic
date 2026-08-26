import type { CompPeriod, JobSource, NormalizedJob } from "../types";
import {
  compFromDescription,
  periodFrom,
  remotePolicyFrom,
  stripHtml,
  yearsFromDescription,
} from "../normalize";

/**
 * Lever postings API.
 *
 * Returns a bare array, not an object — which matters for isRealBoard, since an
 * unknown slug also answers 200.
 *
 * `salaryRange` is present on roughly two thirds of postings in the boards
 * checked while writing this, with the shape
 * `{ interval: "per-year-salary", currency: "USD", min, max }`. When it is
 * absent the description is tried, so a Lever job can end up with comp from
 * either provenance — which is exactly why comp_source is stored per row rather
 * than inferred from the source.
 */

interface LeverSalaryRange {
  interval?: string | null;
  currency?: string | null;
  min?: number | null;
  max?: number | null;
}

interface LeverJob {
  id: string;
  text?: string | null;
  hostedUrl?: string | null;
  applyUrl?: string | null;
  createdAt?: number | null;
  workplaceType?: string | null;
  country?: string | null;
  descriptionPlain?: string | null;
  description?: string | null;
  salaryRange?: LeverSalaryRange | null;
  categories?: {
    commitment?: string | null;
    department?: string | null;
    location?: string | null;
    team?: string | null;
    allLocations?: string[] | null;
  } | null;
}

function structuredComp(range: LeverSalaryRange | null | undefined) {
  if (!range) return null;
  const min = typeof range.min === "number" ? range.min : null;
  const max = typeof range.max === "number" ? range.max : null;
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min > max) return null;

  const period: CompPeriod | null = periodFrom(range.interval);
  return {
    compMin: min,
    compMax: max,
    compCurrency: range.currency?.toUpperCase() ?? null,
    compPeriod: period,
    compSource: "structured" as const,
    compNote: null,
  };
}

export const lever: JobSource = {
  source: "lever",

  boardUrl(slug) {
    return `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  },

  isRealBoard(payload) {
    return Array.isArray(payload);
  },

  parse(payload) {
    const jobs = Array.isArray(payload) ? (payload as LeverJob[]) : [];

    return jobs.map((job): NormalizedJob => {
      const text =
        job.descriptionPlain?.trim() || stripHtml(job.description ?? null);
      const locations = job.categories?.allLocations?.filter(Boolean) ?? [];
      const locationRaw =
        locations.length > 0
          ? locations.join("; ")
          : job.categories?.location?.trim() || null;

      return {
        sourceJobId: job.id,
        title: job.text?.trim() || "(untitled)",
        url: job.hostedUrl ?? job.applyUrl ?? null,

        department: job.categories?.department?.trim() ?? null,
        team: job.categories?.team?.trim() ?? null,
        employmentType: job.categories?.commitment?.trim() ?? null,

        locationRaw,
        remotePolicy: remotePolicyFrom(job.workplaceType, locationRaw),

        ...(structuredComp(job.salaryRange) ?? compFromDescription(text)),
        ...yearsFromDescription(text),

        descriptionHtml: job.description ?? null,
        descriptionText: text,

        postedAt:
          typeof job.createdAt === "number"
            ? new Date(job.createdAt).toISOString()
            : null,

        raw: job,
      };
    });
  },
};
