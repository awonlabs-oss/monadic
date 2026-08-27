"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Draft an email to one person.
 *
 * A panel, not a chat. DESIGN.md section 1.5 is explicit that any AI assistance
 * is a side surface and never the main column, and a conversation thread would
 * make the assistant the thing you maintain instead of the thing you use. What
 * a thread actually gives you here is the ability to say "shorter, less formal"
 * and get another attempt — so that is what this is: instructions, a draft, and
 * a regenerate that keeps what you typed.
 *
 * Nothing is stored until Keep is pressed. A draft you did not like should
 * leave no trace, or the history stops being a set of emails worth reusing.
 *
 * The context is not assembled here. It comes from the database — the parsed
 * resume, the job's own description, the contact's role — which is why there is
 * no upload step: the resume was parsed when it was uploaded and has been
 * structured fields ever since.
 */
export function ComposePanel({
  contactId,
  contactName,
  contactEmail,
  applications,
  previousMessages,
}: {
  contactId: string;
  contactName: string;
  contactEmail: string;
  applications: Array<{ id: string; label: string }>;
  previousMessages: Array<{ id: string; subject: string | null; created_at: string }>;
}) {
  const router = useRouter();
  const [instructions, setInstructions] = useState("");
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [previousId, setPreviousId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-subtle border border-border-subtle bg-surface-canvas px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary";

  async function draft() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          applicationId: applicationId || null,
          previousMessageId: previousId || null,
          instructions,
        }),
      });
      const data = (await response.json()) as {
        subject?: string;
        body?: string;
        context?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Could not draft that.");
        return;
      }
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setContext(data.context ?? "");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function keep() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/outreach/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          applicationId: applicationId || null,
          subject,
          body,
          context,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not save.");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const mailto = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  return (
    <section
      aria-label={`Draft outreach to ${contactName}`}
      className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base px-default py-body shadow-raised"
    >
      <div className="flex flex-col gap-tight">
        <h2 className="text-body font-semibold text-content-primary">Draft outreach</h2>
        <p className="text-caption text-content-tertiary">
          To {contactName} at {contactEmail}. Your parsed resume, the role and
          anything you have already written to them are used automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-compact sm:grid-cols-2">
        {applications.length > 0 && (
          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            About which application
            <select
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              className={field}
            >
              <option value="">No specific role</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {previousMessages.length > 0 && (
          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            Match the voice of
            <select
              value={previousId}
              onChange={(e) => setPreviousId(e.target.value)}
              className={field}
            >
              <option value="">Nothing in particular</option>
              {previousMessages.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.subject || "Untitled"} · {new Date(m.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="flex flex-col gap-tight text-caption text-content-tertiary">
        Anything to steer it
        <textarea
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Warm but brief. Mention the deployment work at Palantir. Ask if they own the req."
          className={`${field} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-compact">
        <button
          type="button"
          onClick={draft}
          disabled={busy}
          className="rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Writing…" : body ? "Regenerate" : "Draft"}
        </button>
        {body && (
          <span className="text-caption text-content-tertiary">
            {body.split(/\s+/).filter(Boolean).length} words
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-caption text-badge-clay-fg">
          {error}
        </p>
      )}

      {body && (
        <div className="flex flex-col gap-compact border-t border-border-subtle pt-compact">
          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            Subject
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSaved(false);
              }}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            Body
            <textarea
              rows={12}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSaved(false);
              }}
              className={`${field} resize-y leading-relaxed`}
            />
          </label>

          <div className="flex flex-wrap items-center gap-compact">
            <button
              type="button"
              onClick={keep}
              disabled={busy || saved}
              className="rounded-subtle border border-border-default bg-surface-sunken px-body py-compact text-small font-medium leading-none text-content-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              {saved ? "Kept ✓" : "Keep"}
            </button>

            {/*
              Until Gmail is connected this is how a draft leaves: the mail
              client opens with it filled in. It is a stopgap and it is honest
              about being one — long bodies are at the mercy of the browser's
              URL limit, which is exactly the problem the Gmail draft solves.
            */}
            <a
              href={mailto}
              className="rounded-subtle bg-coral-default px-body py-compact text-small font-semibold leading-none text-content-primary transition-colors hover:bg-coral-hover"
            >
              Open in mail
            </a>

            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(`${subject}\n\n${body}`)}
              className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
