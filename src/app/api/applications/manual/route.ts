import { revalidatePath } from "next/cache";
import { resolveManualJob } from "@/lib/data/manual-job";
import { saveJob } from "@/lib/data/applications";

/**
 * Add a posting from a pasted link.
 *
 * Two steps, in this order for a reason: the job is resolved first, and only a
 * job that actually resolved gets an application. A failed parse leaves nothing
 * behind — no empty company, no untitled row on the board.
 *
 * saveJob afterwards is the same call the Save button makes, which is what
 * makes the result indistinguishable from any other tracked job: the same
 * interaction row, the same application, the same first timeline event.
 *
 * Slower than the other routes here — an unrecognised link is a page fetch and
 * a model call — so the UI shows progress rather than pretending it is instant.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url : "";
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }
  if (!url.trim()) return Response.json({ error: "Paste a link first." }, { status: 400 });

  try {
    const resolved = await resolveManualJob(url);
    await saveJob(resolved.jobId);

    revalidatePath("/applications");
    revalidatePath("/jobs");

    return Response.json(resolved);
  } catch (error) {
    // These messages are written to be read by the person who pasted the link,
    // so they are returned as-is rather than flattened to "something failed".
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add that link." },
      { status: 422 },
    );
  }
}
