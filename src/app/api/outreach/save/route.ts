import { revalidatePath } from "next/cache";
import { saveMessage } from "@/lib/data/outreach";

/** Keep a draft. Explicit, so the history only holds messages worth reusing. */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const contactId = typeof body.contactId === "string" ? body.contactId : "";
  const bodyText = typeof body.body === "string" ? body.body : "";
  if (!contactId || !bodyText.trim()) {
    return Response.json({ error: "contactId and body are required" }, { status: 400 });
  }

  try {
    const id = await saveMessage({
      contactId,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : null,
      subject: typeof body.subject === "string" ? body.subject : "",
      body: bodyText,
      context: typeof body.context === "string" ? body.context : "",
    });
    revalidatePath(`/contacts/${contactId}`);
    return Response.json({ id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save." },
      { status: 500 },
    );
  }
}
