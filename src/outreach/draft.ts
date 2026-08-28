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

/**
 * What is true of a good outreach email regardless of who wrote it.
 *
 * Deliberately no style rules here. Length, structure and the size of the ask
 * are judgements about whether a busy person reads to the end; whether you open
 * with a greeting is not, and the two do not belong in the same list.
 */
const INVARIANTS = `You write short outreach emails for one person's job search.
You are given who they are, who they are writing to, and the role in question.

The email must be something a busy recruiter reads to the end:

- Under 150 words. Four short paragraphs at most, usually three.
- A single, small ask. An interview is not a small ask; fifteen minutes, or
  whether they are the right person to speak to, is.
- Never invent a project, a metric, an employer, a duration or a shared
  connection. Everything specific must come from the context you are given.
- If a fact is missing, write around it. An email that says less and is true is
  the one that works.

Write to the person you are actually writing to. Their relationship to the role
changes what is true of them, and getting it wrong is the tell that an email was
generated:

- A recruiter does not own the team and is not building the product. "Your
  team", "the product you're building", "your roadmap" are all wrong for them.
  They are the way in — refer to the company, not to their work.
- A hiring manager does own the team. "Your team" is correct and specific, and
  the reason for writing is the work itself.
- A referral is someone inside the company who can point you at the right
  person. Ask them who to speak to, not for the role.
- An interviewer has already met you. Do not introduce yourself as a stranger.
- When the relationship is not stated, write as though to a recruiter. It is the
  safe assumption: nothing in that register is wrong for anyone else.

The company is given to you below as "Company". Use that name — do not infer one
from the role, the contact's email domain, or the description.

The subject line is almost always exactly:

  Interest in <the role title> role at <the company>

Both values are given below. Do not paraphrase the title, do not shorten the
company, and do not write a cleverer subject — an initial email is opened
because the subject says plainly what it is about. Depart from this only when
the person asked for something specific, or when there is no role to name.`;

/**
 * The fallback voice, used only when the sender has shown us nothing.
 *
 * These are prohibitions, and prohibitions are the right tool for exactly one
 * situation: no examples, no stated rules, and a model that will otherwise
 * reach for the phrases every other candidate uses. They are a floor, not a
 * standard — and the moment there is a real example to match, they are worse
 * than nothing, because a real person's actual habits will trip several of
 * them. See voiceFor.
 */
const HOUSE_STYLE = `No house voice has been supplied, so write plainly and
avoid the phrases that make an email look automated: no "I hope this email finds
you well", no "I came across your profile", no "passionate about", no "I'd love
to", no em dashes as connectors. Open with why this person and this company.
Sign off with the sender's first name alone.`;

/** The relationship, as a sentence rather than as a database enum value. */
const RELATIONSHIP_LABELS: Record<string, string> = {
  recruiter: "recruiter — the way in, does not own the team or build the product",
  hiring_manager: "hiring manager — owns the team and the role",
  referral: "referral — inside the company, can point me at the right person",
  interviewer: "interviewer — has already met me",
  other: "not stated — treat as a recruiter",
};

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
      // Spelled out rather than passed as the raw enum value. "hiring_manager"
      // is a database value; what the model needs is the sentence that says
      // what such a person can and cannot be told about "your team".
      block("Relationship", RELATIONSHIP_LABELS[ctx.contact.role ?? ""] ?? "not stated — treat as a recruiter"),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  /*
   * One company name, resolved here rather than left to the model.
   *
   * Two candidates exist — the company on the job and the company on the
   * contact — and asking the model to pick between them is how a subject line
   * ends up naming the wrong one. The job wins when there is a job, because
   * that is what the email is about; the contact's company is the fallback for
   * outreach with no specific role attached.
   */
  const company = ctx.job?.companyName?.trim() || ctx.company?.name?.trim() || null;
  parts.push(company ? `Company: ${company}` : "Company: not known — do not name one");

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
 * The system prompt, assembled from what the sender has actually given us.
 *
 * The important case is the third one. When real examples exist, the house
 * style is *dropped* rather than layered under them — and that is a correction,
 * not a preference. Written for a generic sender, the fallback bans "I hope
 * this email finds you well" and "I'd love to" and demands the email open with
 * the company. Those are reasonable defaults against a model with nothing to
 * imitate, and they are simply wrong about a specific person: real emails from
 * this codebase's own user open "Hope you are doing well", say "would love to
 * learn more", and lead with a greeting and a one-line self-introduction.
 *
 * Keeping both would put the prohibitions in direct conflict with the examples
 * they are supposed to defer to, and a model handed a rule and a demonstration
 * that disagree will split the difference — producing something in neither
 * voice. Prohibitions guard against having nothing better; an example is
 * something better.
 *
 * Guidelines always apply, and always last. Someone who wrote down how they
 * want their email to read outranks any prompt written for everyone.
 */
export function voiceFor(guidelines: string, hasExamples: boolean): string {
  const parts = [INVARIANTS];

  if (hasExamples) {
    parts.push(`Emails the sender actually wrote appear earlier in this
conversation as your own prior replies. Match them: their greeting, their
register, their sentence length, how they introduce themselves, how they sign
off. Where those examples differ from anything you would otherwise write,
the examples are right — they are how this person actually writes. Do not copy
their specifics; the role, company and details come from the context below.`);
  } else {
    parts.push(HOUSE_STYLE);
  }

  if (guidelines.trim()) {
    parts.push(`The sender has stated how they want their email written. This
overrides everything above:\n\n${guidelines.trim()}`);
  }

  return parts.join("\n\n");
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
    system: voiceFor(ctx.guidelines, ctx.examples.length > 0),
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
    system: `${voiceFor(ctx.guidelines, ctx.examples.length > 0)}

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
