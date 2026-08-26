import Anthropic from "@anthropic-ai/sdk";
import { anthropicApiKey } from "@/lib/env";
import { RESUME_SCHEMA, type ParsedResume } from "./schema";

/**
 * Resume parsing, behind an interface.
 *
 * One implementation today. The interface exists because the choice of parser
 * is a decision that may change — a local extractor, a different provider — and
 * everything downstream stores the same shape regardless.
 */

export interface ResumeInput {
  filename: string;
  mediaType: "application/pdf" | "text/plain";
  /** PDFs go to the model as bytes; extracted text goes as text. */
  data: string;
}

export interface ResumeParser {
  readonly id: string;
  parse(input: ResumeInput): Promise<ParsedResume>;
}

const MODEL = "claude-opus-5";

const SYSTEM = `You extract structured data from resumes.

Transcribe, do not infer. If the resume does not state something, the field is
null — an invented start date or an assumed seniority is worse than an absent
one, because everything downstream will treat it as fact.

Two things do warrant computation rather than transcription:
- yearsExperienceTotal, from the role dates. Null if the dates do not support it.
- startDate/endDate as ISO 8601, normalising partial dates to the first of the
  month or year. Keep the original wording in startText/endText, because that is
  what gets shown back when the normalisation is wrong.

List every named skill and technology separately. A comma-separated line on the
resume is many skills, not one.`;

/**
 * Anthropic implementation.
 *
 * PDFs are sent as a document block rather than being text-extracted first: the
 * model reads the layout directly, which matters because resumes are frequently
 * multi-column and a text extractor interleaves the columns into nonsense. That
 * also removes a dependency the deterministic route would have needed.
 *
 * Output is constrained by RESUME_SCHEMA via structured outputs, so the response
 * is guaranteed to match the shape. No response validation library is involved,
 * and there is no parse-retry loop, because there is nothing for the model to
 * get structurally wrong.
 */
export class AnthropicResumeParser implements ResumeParser {
  readonly id = "anthropic";

  async parse(input: ResumeInput): Promise<ParsedResume> {
    const client = new Anthropic({ apiKey: anthropicApiKey() });

    const content: Anthropic.ContentBlockParam[] =
      input.mediaType === "application/pdf"
        ? [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: input.data },
            },
            { type: "text", text: "Extract this resume." },
          ]
        : [{ type: "text", text: `Extract this resume.\n\n${input.data}` }];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: RESUME_SCHEMA } },
      messages: [{ role: "user", content }],
    });

    // Checked before reading content: a refusal returns HTTP 200 with an empty
    // or partial content array, so indexing straight into content[0] would
    // throw something unrelated to what actually happened.
    if (response.stop_reason === "refusal") {
      throw new Error(
        "The model declined to parse this file. If it is a genuine resume, this is a false positive — try again or use a different file.",
      );
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      throw new Error(
        `The parse returned no text (stop_reason: ${response.stop_reason}). If this was max_tokens, the resume is unusually long.`,
      );
    }

    return JSON.parse(text.text) as ParsedResume;
  }
}

export function resumeParser(): ResumeParser {
  return new AnthropicResumeParser();
}
