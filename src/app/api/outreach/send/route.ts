import { revalidatePath } from "next/cache";
import { sendMessage, connectedAccount } from "@/outreach/gmail";
import { saveMessage, markSent } from "@/lib/data/outreach";

/**
 * Send a reviewed email.
 *
 * The `confirmed` flag is required and must be exactly true. It is not
 * security — anything that can reach this route can set it — it is a guard
 * against the accident this route is one refactor away from: a client that
 * calls send where it meant to call draft, or a retry that fires without the
 * review having happened. A required field that only the review screen sets
 * makes that mistake fail loudly instead of silently mailing someone.
 *
 * Sending is not undoable, so everything that can be checked is checked before
 * the call: the account is connected, the recipient is present, the body is not
 * empty. A message with a blank subject is allowed — that is a choice, not an
 * error — but a message to nobody is not.
 *
 * The copy is stored first and marked sent afterwards. If Gmail succeeds and
 * the marking fails, the history shows an unsent draft of something that went
 * out, which is recoverable by looking at Gmail. The other order risks a record
 * claiming an email was sent that never left.
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

  if (body.confirmed !== true) {
    return Response.json(
      { error: "This message has not been reviewed. Nothing was sent." },
      { status: 400 },
    );
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const text = typeof body.body === "string" ? body.body : "";
  const contactId = typeof body.contactId === "string" ? body.contactId : "";

  if (!to || !text.trim() || !contactId) {
    return Response.json(
      { error: "A recipient, a body and a contact are all required." },
      { status: 400 },
    );
  }

  const account = await connectedAccount();
  if (!account) {
    return Response.json(
      { error: "Gmail is not connected. Connect it on your profile first." },
      { status: 409 },
    );
  }

  let messageId: string;
  try {
    const id = await saveMessage({
      contactId,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : null,
      subject,
      body: text,
      context: typeof body.context === "string" ? body.context : "",
    });
    messageId = id;

    const sent = await sendMessage({ to, subject, body: text });
    await markSent(messageId);

    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/applications");
    return Response.json({ sent: true, from: account.email, messageId: sent.messageId });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not send." },
      { status: 502 },
    );
  }
}
