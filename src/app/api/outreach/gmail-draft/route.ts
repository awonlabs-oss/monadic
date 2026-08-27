import { createDraft } from "@/outreach/gmail";
import { saveMessage } from "@/lib/data/outreach";
import { revalidatePath } from "next/cache";

/**
 * Put a draft into Gmail, and keep a copy here.
 *
 * It creates a draft. It does not send — the scope granted is gmail.compose,
 * so sending is not something this code could do even if it tried.
 *
 * The message is stored on this side too, because the point of the history is
 * to have the text when writing the next one, and reading it back out of Gmail
 * would mean a second API round trip and a wider scope to do it with.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const text = typeof body.body === "string" ? body.body : "";
  const contactId = typeof body.contactId === "string" ? body.contactId : "";

  if (!to || !text.trim() || !contactId) {
    return Response.json(
      { error: "to, body and contactId are required" },
      { status: 400 },
    );
  }

  try {
    const draft = await createDraft({ to, subject, body: text });
    await saveMessage({
      contactId,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : null,
      subject,
      body: text,
      context: typeof body.context === "string" ? body.context : "",
    });
    revalidatePath(`/contacts/${contactId}`);
    return Response.json({ draftId: draft.draftId });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not create the draft." },
      { status: 502 },
    );
  }
}
