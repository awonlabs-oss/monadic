import { revalidatePath } from "next/cache";
import { saveJob } from "@/lib/data/applications";

/**
 * Save, without re-rendering the page you pressed it on.
 *
 * This exists instead of calling the server action from the button, and the
 * difference is the whole point. A server action re-renders the route it was
 * invoked from and streams the new payload back — which on /for-you deletes the
 * card under your cursor, because recommend_jobs excludes anything saved. The
 * exclusion is right: a decided job should not greet you again next visit. It
 * is just not meant to happen while you are looking at it.
 *
 * A route handler has no such coupling. The write lands, the button flips, the
 * list stays exactly as it was, and the job is gone the next time the feed is
 * built — which is what "excluded from recommendations" was always supposed to
 * mean.
 *
 * /jobs and /applications are still revalidated, so the board and the search
 * feed are correct the next time either is visited. Neither is the page this
 * was called from, so neither causes a visible re-render here.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let jobId: string;
  try {
    const body = (await request.json()) as { jobId?: unknown };
    jobId = typeof body.jobId === "string" ? body.jobId : "";
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  try {
    await saveJob(jobId);
  } catch (error) {
    // The button reverts on a non-2xx, so the message only has to be true, not
    // presentable — nothing renders it.
    return Response.json(
      { error: error instanceof Error ? error.message : "save failed" },
      { status: 500 },
    );
  }

  revalidatePath("/jobs");
  revalidatePath("/applications");

  return Response.json({ saved: true });
}
