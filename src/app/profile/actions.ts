"use server";

import { revalidatePath } from "next/cache";
import { resumeParser } from "@/profile/parser";
import { replaceParsedProfile } from "@/lib/data/profile";

/**
 * Resume upload and parse.
 *
 * The file is never stored — only the structured parse, the untouched parser
 * output, and the filename. There is nothing to leak and nothing to gitignore,
 * and a resume is the most personal thing this application will ever handle.
 *
 * PDFs go to the model as bytes. Plain text is passed through. DOCX needs a
 * text extractor that is not installed yet, so it is refused with a message
 * saying so rather than failing somewhere less obvious.
 */

const MAX_BYTES = 8 * 1024 * 1024;

export type UploadState = { status: "idle" | "ok"; error: string | null };

/**
 * Shaped for useActionState so failures have somewhere to render. A plain
 * <form action> must return void, which would leave every one of the error
 * messages below with nowhere to go — the upload would appear to do nothing.
 */
export async function uploadResumeAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "idle", error: "Choose a file first." };
  }
  if (file.size > MAX_BYTES) {
    return {
      status: "idle",
      error: `That file is ${(file.size / 1_048_576).toFixed(1)}MB. The limit is 8MB.`,
    };
  }

  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());

  let input;
  if (name.endsWith(".pdf")) {
    input = {
      filename: file.name,
      mediaType: "application/pdf" as const,
      data: bytes.toString("base64"),
    };
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    input = {
      filename: file.name,
      mediaType: "text/plain" as const,
      data: bytes.toString("utf8"),
    };
  } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return {
      status: "idle",
      error:
        "DOCX is not supported yet — it needs a text extractor that has not been added. Export to PDF and upload that.",
    };
  } else {
    return { status: "idle", error: "Upload a PDF, or a .txt/.md file." };
  }

  const parser = resumeParser();

  let parsed;
  try {
    parsed = await parser.parse(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The most common failure by far is a missing API key, so it gets its own
    // message rather than surfacing the SDK's.
    if (/api[_ -]?key/i.test(message)) {
      return {
        status: "idle",
        error:
          "ANTHROPIC_API_KEY is not set in .env.local. Add it and restart the dev server.",
      };
    }
    return { status: "idle", error: message };
  }

  await replaceParsedProfile(parsed, {
    filename: file.name,
    fileType: name.endsWith(".pdf") ? "pdf" : "txt",
    parserId: parser.id,
  });

  revalidatePath("/profile");
  return { status: "ok", error: null };
}
