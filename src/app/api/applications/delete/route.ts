import { revalidatePath } from "next/cache";
import { deleteApplication } from "@/lib/data/applications";

/**
 * Remove a tracked application.
 *
 * A route handler like the other two, for the same reason: the board should not
 * be rebuilt underneath the row being removed. The client drops the row itself
 * and the server agrees on the next load.
 *
 * /jobs is revalidated because the feed reads the interaction this clears —
 * without it, the card for a job you just untracked would still say Saved.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let applicationId = "";
  try {
    const body = (await request.json()) as { applicationId?: unknown };
    applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }
  if (!applicationId) {
    return Response.json({ error: "applicationId is required" }, { status: 400 });
  }

  try {
    const removed = await deleteApplication(applicationId);
    if (!removed) {
      return Response.json({ error: "That application no longer exists." }, { status: 404 });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "delete failed" },
      { status: 500 },
    );
  }

  revalidatePath("/applications");
  revalidatePath("/jobs");
  return Response.json({ deleted: true });
}
