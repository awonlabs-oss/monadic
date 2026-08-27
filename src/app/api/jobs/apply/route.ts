import { revalidatePath } from "next/cache";
import { markJobApplied } from "@/lib/data/applications";

/**
 * Record that Apply was pressed.
 *
 * Fired alongside the navigation to the company's board rather than instead of
 * it — the link opens in a new tab, so this page is still here to receive the
 * answer. The button does not wait for it: the tab should open the instant it
 * is clicked, and a bookkeeping write is not worth a frame of delay.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let jobId = "";
  try {
    const body = (await request.json()) as { jobId?: unknown };
    jobId = typeof body.jobId === "string" ? body.jobId : "";
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }
  if (!jobId) return Response.json({ error: "jobId is required" }, { status: 400 });

  try {
    await markJobApplied(jobId);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "apply failed" },
      { status: 500 },
    );
  }

  revalidatePath("/applications");
  revalidatePath("/jobs");
  return Response.json({ applied: true });
}
