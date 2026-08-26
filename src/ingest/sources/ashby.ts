import type { JobSource, NormalizedJob } from "../types";
import {
  compFromDescription,
  periodFrom,
  remotePolicyFrom,
  stripHtml,
  yearsFromDescription,
} from "../normalize";

/**
 * Ashby job board posting API.
 *
 * The best structured compensation of the three, when asked for it with
 * includeCompensation=true — 130 of 135 postings carried one on the board
 * checked while writing this.
 *
 * The shape is a tier list, and the tiers mix pay with equity:
 *
 *   compensation.compensationTiers[].components[] = {
 *     compensationType: "Salary" | "EquityPercentage" | ...,
 *     interval: "YEAR" | "NONE" | ...,
 *     currencyCode, minValue, maxValue
 *   }
 *
 * Only Salary components are read. Taking the first component blindly would
 * report an equity percentage as a salary, which is the kind of wrong that
 * looks plausible in a list view and is therefore worse than empty.
 *
 * `isListed: false` postings are filtered out — they exist on the board object
 * but are not publicly open roles.
 */

interface AshbyComponent {
  compensationType?: string | null;
  interval?: string | null;
  currencyCode?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  summary?: string | null;
}

interface AshbyJob {
  id: string;
  title?: string | null;
  location?: string | null;
  address?: unknown;
  secondaryLocations?: Array<{ location?: string | null }> | null;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  isRemote?: boolean | null;
  isListed?: boolean | null;
  workplaceType?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  publishedAt?: string | null;
  compensation?: {
    compensationTierSummary?: string | null;
    compensationTiers?: Array<{
      tierSummary?: string | null;
      components?: AshbyComponent[] | null;
    }> | null;
  } | null;
}

interface AshbyBoard {
  jobs?: AshbyJob[];
}

const SALARY_TYPE = /salary|base/i;

function structuredComp(job: AshbyJob) {
  const tiers = job.compensation?.compensationTiers ?? [];
  for (const tier of tiers) {
    for (const component of tier.components ?? []) {
      if (!component.compensationType || !SALARY_TYPE.test(component.compensationType)) {
        continue;
      }
      const min = typeof component.minValue === "number" ? component.minValue : null;
      const max = typeof component.maxValue === "number" ? component.maxValue : null;
      if (min === null && max === null) continue;
      if (min !== null && max !== null && min > max) continue;

      return {
        compMin: min,
        compMax: max,
        compCurrency: component.currencyCode?.toUpperCase() ?? null,
        compPeriod: periodFrom(component.interval),
        compSource: "structured" as const,
        // The board's own rendering of the tier, kept because it carries the
        // equity and bonus context the numeric range drops.
        compNote:
          job.compensation?.compensationTierSummary?.trim() ??
          tier.tierSummary?.trim() ??
          null,
      };
    }
  }
  return null;
}

export const ashby: JobSource = {
  source: "ashby",

  boardUrl(slug) {
    return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;
  },

  isRealBoard(payload) {
    return Array.isArray((payload as AshbyBoard | null)?.jobs);
  },

  parse(payload) {
    const jobs = ((payload as AshbyBoard | null)?.jobs ?? []).filter(
      (job) => job.isListed !== false,
    );

    return jobs.map((job): NormalizedJob => {
      const text = job.descriptionPlain?.trim() || stripHtml(job.descriptionHtml ?? null);

      const secondary =
        job.secondaryLocations?.map((l) => l.location).filter(Boolean) ?? [];
      const locationRaw =
        [job.location?.trim(), ...secondary].filter(Boolean).join("; ") || null;

      return {
        sourceJobId: job.id,
        title: job.title?.trim() || "(untitled)",
        url: job.jobUrl ?? job.applyUrl ?? null,

        department: job.department?.trim() ?? null,
        team: job.team?.trim() ?? null,
        employmentType: job.employmentType?.trim() ?? null,

        locationRaw,
        // workplaceType is the authoritative field; isRemote is a weaker hint
        // and is true on some postings that are actually hybrid.
        remotePolicy:
          remotePolicyFrom(job.workplaceType) ??
          (job.isRemote === true ? "remote" : null),

        ...(structuredComp(job) ?? compFromDescription(text)),
        ...yearsFromDescription(text),

        descriptionHtml: job.descriptionHtml ?? null,
        descriptionText: text,

        postedAt: job.publishedAt ?? null,

        raw: job,
      };
    });
  },
};
