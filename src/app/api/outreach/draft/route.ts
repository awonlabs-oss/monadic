import { buildDraftContext } from "@/lib/data/outreach";
import { streamOutreach, renderContext } from "@/outreach/draft";

/**
 * Draft an email, streamed. Writes nothing.
 *
 * The response is the text itself, streamed, rather than JSON delivered at the
 * end. That is the difference between a button that sits dead for nine seconds
 * and then dumps a finished email, and one where the first sentence appears in
 * about a second and the rest fills in behind it. The work takes the same time
 * either way; only one of them tells you it is working.
 *
 * Plain text, not server-sent events. SSE exists to multiplex named event types
 * over one connection, and there is one thing on this connection. A text/plain
 * body read with a stream reader is the whole protocol.
 *
 * The rendered context rides in a header rather than the body, so it does not
 * have to be framed out of the token stream. It is what gets stored with a kept
 * message, which is what makes a bad draft diagnosable later.
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

  let context;
  try {
    context = await buildDraftContext({
      contactId,
      applicationId: typeof body.applicationId === "string" ? body.applicationId : null,
      previousMessageId:
        typeof body.previousMessageId === "string" ? body.previousMessageId : null,
      instructions: typeof body.instructions === "string" ? body.instructions : "",
    });
  } catch (error) {
    // Context assembly happens before the stream opens, so a failure here can
    // still be an ordinary status code. Once bytes are flowing it cannot.
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not draft that." },
      { status: 422 },
    );
  }

  const rendered = renderContext(context);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamOutreach(context)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        // The status line is long gone by now. The only place left to say
        // anything is the stream itself, on its own line so the client can
        // recognise it rather than rendering it as part of the email.
        controller.enqueue(
          encoder.encode(
            `\n\n[[error]] ${error instanceof Error ? error.message : "the draft stopped early"}`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Proxies that buffer would defeat the entire point of streaming.
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
      "x-draft-context": Buffer.from(rendered, "utf8").toString("base64"),
    },
  });
}
