"use client";

import { useActionState } from "react";
import { uploadResumeAction, type UploadState } from "@/app/profile/actions";

/**
 * Resume upload form.
 *
 * A client component for one reason: useActionState, so a failed parse has
 * somewhere to render. Every failure here is one the user can act on — a
 * missing API key, an unsupported format, a file too large — and a plain
 * server-action form would swallow all of them, leaving the upload looking
 * like it silently did nothing.
 */
export function ResumeUpload({ hasProfile }: { hasProfile: boolean }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadResumeAction,
    { status: "idle", error: null },
  );

  return (
    <section
      aria-labelledby="upload-heading"
      className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base p-default"
    >
      <h2 id="upload-heading" className="text-small font-medium text-content-primary">
        {hasProfile ? "Replace resume" : "Upload resume"}
      </h2>
      <p className="text-caption text-content-tertiary">
        PDF, or plain text. The file itself is never stored — only the parsed
        result. Re-uploading replaces parsed fields and leaves anything you
        edited by hand alone.
      </p>

      <form action={action} className="flex flex-wrap items-center gap-tight">
        <label htmlFor="resume" className="sr-only">
          Resume file
        </label>
        <input
          id="resume"
          type="file"
          name="resume"
          accept=".pdf,.txt,.md"
          required
          disabled={pending}
          className="min-w-0 flex-1 rounded-subtle border border-border-subtle bg-surface-base px-default py-compact text-small text-content-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Parsing…" : "Parse"}
        </button>
      </form>

      {pending && (
        <p aria-live="polite" className="text-caption text-content-tertiary">
          Reading the resume. This takes a few seconds.
        </p>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-subtle bg-badge-amber-bg px-compact py-tight text-caption text-badge-amber-fg"
        >
          {state.error}
        </p>
      )}
    </section>
  );
}
