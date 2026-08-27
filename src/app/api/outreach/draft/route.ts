import { buildDraftContext } from "@/lib/data/outreach";
import { draftOutreach, renderContext } from "@/outreach/draft";

/**
 * Draft an email. Writes nothing.
 *
 * Saving is a separate, explicit act — a draft you did not like should leave no
 * trace, and a generate button that quietly filled a history with rejected
 * attempts would make the history worth less than not having one.
 *
 * The rendered context comes back with the draft so the client can store it
 * alongside the message if it is kept. That is what makes a bad draft
 * diagnosable later: the answer to "why did it say that" is what it was given.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: {
    contactId?: unknown;
    applicationId?: unknown;
    previousMessageId?: unknown;
    instructions?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const contactId = typeof body.contactId === "string" ? body.contactId : "";
  if (!contactId) return Response.json({ error: "contactId is required" }, { status: 400 });

  try {
    const context = await buildDraftContext({
      contactId,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : null,
      previousMessageId:
        typeof body.previousMessageId === "string" ? body.previousMessageId : null,
      instructions: typeof body.instructions === "string" ? body.instructions : "",
    });

    const draft = await draftOutreach(context);
    return Response.json({ ...draft, context: renderContext(context) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not draft that." },
      { status: 422 },
    );
  }
}
