import { searchJobs } from "@/lib/data/jobs";
import { parseFilters } from "@/lib/filters";

/**
 * How many roles a set of filters would return, without applying them.
 *
 * The filter panel's submit button states the size of the result before you
 * commit to it, and that number has to be the real one. It cannot be derived on
 * the client: the facet counts each hold one dimension with the others applied,
 * so combining two of them is not arithmetic that means anything. An estimate
 * would be worse than no number, because the button reads as a promise.
 *
 * Filters are parsed by the same parseFilters the page uses, from the same
 * query string the form would have submitted, so the count and the subsequent
 * navigation cannot disagree about what the form said.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  // Rebuilt as the page's own searchParams shape: repeated keys become arrays,
  // single ones stay scalar. parseFilters reads the last value of a repeated
  // key, which is how a hidden "off" default paired with a checkbox resolves.
  const params: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    params[key] = all.length > 1 ? all : all[0];
  }

  try {
    // One row, because only the total is wanted; searchJobs computes it with a
    // window function in the same pass, so this is not a second query.
    const { total } = await searchJobs(parseFilters(params), 1, 0);
    return Response.json({ total });
  } catch (error) {
    // The button falls back to its server-rendered number on a failure rather
    // than showing a wrong one.
    return Response.json(
      { error: error instanceof Error ? error.message : "count failed" },
      { status: 500 },
    );
  }
}
