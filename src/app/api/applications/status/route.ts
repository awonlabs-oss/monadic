import { revalidatePath } from "next/cache";
import { setApplicationStatus } from "@/lib/data/applications";
import { ALL_STATUSES, type Status } from "@/lib/applications/pipeline";

/**
 * Change a status without re-rendering the board underneath it.
 *
 * Same reasoning as the save route: a server action re-renders the route it
 * was invoked from, which on /applications means the card you just moved is
 * torn down and rebuilt in another column while your cursor is still on it.
 * The picker updates itself; the board is correct on the next visit.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let applicationId = "";
  let status = "";
  try {
    const body = (await request.json()) as { applicationId?: unknown; status?: unknown };
    applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
    status = typeof body.status === "string" ? body.status : "";
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  if (!applicationId) {
    return Response.json({ error: "applicationId is required" }, { status: 400 });
  }
  // Checked against the same list the UI offers, so a typo cannot reach the
  // check constraint and come back as a database error.
  if (!(ALL_STATUSES as string[]).includes(status)) {
    return Response.json({ error: `unknown status: ${status}` }, { status: 400 });
  }

  try {
    await setApplicationStatus(applicationId, status as Status);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "status change failed" },
      { status: 500 },
    );
  }

  revalidatePath("/applications");
  return Response.json({ status });
}
