import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/env";

/**
 * Drafting an outreach email.
 *
 * The whole value here is context. A generic "I am interested in this role"
 * email is worse than no email, and the difference between that and a good one
 * is entirely whether the writer knew who they were writing to and what they
 * had actually done. All of that is already in the database — the resume is
 * parsed into structured fields, the job carries its own description, the
 * contact carries a name and a relationship — so the drafting step assembles
 * rather than asks.
 *
 * Output is constrained by DRAFT_SCHEMA through structured outputs, so subject
 * and body arrive as separate fields instead of being pulled apart from prose
 * with a regex.
 */

const MODEL = "claude-opus-5";

export interface DraftContext {
  contact: { fullName: string; title: string | null; role: string | null };
  company: { name: string } | null;
  job: {
    title: string;
    companyName: string;
    locationRaw: string | null;
    description: string | null;
  } | null;
  profile: {
    fullName: string | null;
    headline: string | null;
    summary: string | null;
    yearsExperience: number | null;
    experiences: Array<{ title: string | null; company: string; description: string | null }>;
    skills: string[];
  } | null;
  /** A previous message to this person, so the voice stays continuous. */
  previous: { subject: string | null; body: string } | null;
  /** What the person asked for in their own words. May be empty. */
  instructions: string;
  /** Rules the sender has stated about their own writing. */
  guidelines: string;
  /** Emails the sender actually wrote. Worth more than any description. */
  examples: Array<{ name: string; subject: string | null; body: string }>;
}

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: {
      type: "string",
      description:
        "A subject line under 60 characters. Specific enough that it is obviously not a mass send. No 'Quick question', no 'Touching base'.",
    },
    body: {
      type: "string",
      description:
        "The email body as plain text with blank lines between paragraphs. No markdown, no bullet characters, no signature block beyond the sender's first name.",
    },
  },
} as const;

const SYSTEM = `You write short outreach emails for one person's job search. You
are given who they are, who they are writing to, and the role in question.

The email must be something a busy recruiter reads to the end. That means:

- Under 150 words. Four short paragraphs at most, usually three.
- Open with why this specific person, at this specific company. Never "I hope
  this email finds you well" or "I came across your profile".
- One concrete, checkable thing from the sender's own history that bears on the
  role. Take it from the experience given to you; do not invent a project, a
  metric, a company or a duration.
- A single, small ask. An interview is not a small ask; fifteen minutes, or
  whether they are the right person to speak to, is.
- Sign off with the sender's first name alone.

Write in plain English. No em dashes as connectors, no "I'd love to", no
"passionate about", no "reach out". If a sentence could appear in any other
candidate's email, cut it.

If a fact is missing from the context, write around it rather than guessing at
it. An email that says less and is true is the one that works.`;

function block(label: string, value: string | null | undefined): string {
  return value?.trim() ? `${label}: ${value.trim()}` : "";
}

/** The context, as the model receives it. Also stored as variables_snapshot. */
export function renderContext(ctx: DraftContext): string {
  const parts: string[] = [];

  parts.push("## Who is writing");
  if (ctx.profile) {
    parts.push(
      [
        block("Name", ctx.profile.fullName),
        block("Headline", ctx.profile.headline),
        block("Years of experience", ctx.profile.yearsExperience?.toString() ?? null),
        block("Summary", ctx.profile.summary),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (ctx.profile.experiences.length > 0) {
      parts.push(
        "Recent experience:\n" +
          ctx.profile.experiences
            .slice(0, 4)
            .map(
              (e) =>
                `- ${e.title ?? "Role not stated"} at ${e.company}` +
                (e.description ? `: ${e.description.slice(0, 400)}` : ""),
            )
            .join("\n"),
      );
    }
    if (ctx.profile.skills.length > 0) {
      parts.push(`Skills: ${ctx.profile.skills.slice(0, 25).join(", ")}`);
    }
  } else {
    parts.push("No parsed profile available. Do not invent a background.");
  }

  parts.push("\n## Who they are writing to");
  parts.push(
    [
      block("Name", ctx.contact.fullName),
      block("Title", ctx.contact.title),
      block("Relationship", ctx.contact.role),
      block("Company", ctx.company?.name ?? null),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (ctx.job) {
    parts.push("\n## The role");
    parts.push(
      [
        block("Title", ctx.job.title),
        block("Company", ctx.job.companyName),
        block("Location", ctx.job.locationRaw),
        // Truncated: the top of a posting carries the role and the team, which
        // is what the email needs. The benefits section is not going to appear
        // in three paragraphs.
        block("Description", ctx.job.description?.slice(0, 6000) ?? null),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (ctx.previous) {
    parts.push("\n## A previous email from this sender, for voice only");
    parts.push(
      "Match its register and length. Do not repeat its content — this is a different message.",
    );
    parts.push(
      [block("Subject", ctx.previous.subject), block("Body", ctx.previous.body)]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (ctx.instructions.trim()) {
    parts.push("\n## What the sender asked for");
    parts.push(ctx.instructions.trim());
  }

  return parts.filter(Boolean).join("\n");
}

/**
 * The system prompt, with the sender's own rules appended.
 *
 * Their rules go last and are framed as overriding, because that is what they
 * are: the defaults above are a reasonable house style, and a person who has
 * written out how they want their email to read has more authority on it than
 * a prompt written for everyone.
 */
export function systemFor(guidelines: string): string {
  if (!guidelines.trim()) return SYSTEM;
  return `${SYSTEM}

The sender has stated how they want their email written. Where this conflicts
with anything above, follow the sender:

${guidelines.trim()}`;
}

/**
 * Worked examples, as conversation turns rather than as text in the prompt.
 *
 * This is the part that matters most and the part that is easiest to get
 * wrong. Pasting an example into the system prompt describes it; replaying it
 * as an assistant turn *demonstrates* it, and a model matches the register,
 * length and shape of a demonstrated answer far more closely than one it was
 * told about. Voice is mostly things a person cannot articulate about their own
 * writing, so showing beats describing.
 *
 * Each example becomes a minimal user turn and the real reply. The user turn is
 * deliberately vague — the example's value is the answer, and inventing a
 * detailed brief for it would teach the model to expect briefs it will not get.
 */
export function exampleTurns(
  examples: DraftContext["examples"],
): Array<{ role: "user" | "assistant"; content: string }> {
  return examples.slice(0, 4).flatMap((example) => [
    {
      role: "user" as const,
      content: `Write an outreach email. (Reference: ${example.name})`,
    },
    {
      role: "assistant" as const,
      content: example.subject
        ? `Subject: ${example.subject}\n\n${example.body}`
        : example.body,
    },
  ]);
}

export async function draftOutreach(
  ctx: DraftContext,
): Promise<{ subject: string; body: string }> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: systemFor(ctx.guidelines),
    output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
    messages: [...exampleTurns(ctx.examples), { role: "user", content: renderContext(ctx) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to draft that. Try different instructions.");
  }
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error(
      `No draft came back (stop_reason: ${response.stop_reason}). If this was max_tokens, shorten the instructions.`,
    );
  }

  const parsed = JSON.parse(block.text) as { subject: string; body: string };
  return { subject: parsed.subject.trim(), body: parsed.body.trim() };
}


/**
 * The same draft, streamed as it is written.
 *
 * Structured outputs are deliberately not used here, and that is the whole
 * design decision. They stream too — but what arrives is partial JSON, so the
 * body reaches the client escaped and in fragments that only become text once
 * the object closes. Rendering paragraphs as they are written means the text
 * has to arrive *as text*.
 *
 * So the format is a header line and a blank line, which the client splits on.
 * It costs the schema guarantee and buys a body that can be appended to a DOM
 * node the moment each token lands.
 *
 * Effort is low. This is a 120-word email, not a reasoning problem: adaptive
 * thinking is left on (disabling it on this model risks tag leakage into the
 * visible response), but at low effort it finishes quickly, so the first
 * sentence appears in about a second rather than after a long silent pause.
 */
export async function* streamOutreach(ctx: DraftContext): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: anthropicApiKey() });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    system: `${systemFor(ctx.guidelines)}

Reply with exactly this shape and nothing else:

Subject: <the subject line>

<the body>

No preamble, no explanation, no markdown fences.`,
    output_config: { effort: "low" },
    messages: [...exampleTurns(ctx.examples), { role: "user", content: renderContext(ctx) }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
