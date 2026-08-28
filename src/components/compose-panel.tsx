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
  gmailConnected,
  gmailAddress,
}: {
  contactId: string;
  contactName: string;
  contactEmail: string;
  applications: Array<{ id: string; label: string }>;
  previousMessages: Array<{ id: string; subject: string | null; created_at: string }>;
  /** Shows the Gmail actions. Connected on /profile. */
  gmailConnected: boolean;
  /** The mailbox a send would go out from. Named on the review screen. */
  gmailAddress: string | null;
}) {
  const router = useRouter();
  const [instructions, setInstructions] = useState("");
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [previousId, setPreviousId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inGmail, setInGmail] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const field =
    "w-full rounded-subtle border border-border-subtle bg-surface-canvas px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary";

  async function draft() {
    setBusy(true);
    setError(null);
    setSaved(false);
    setInGmail(false);
    setSubject("");
    setBody("");
    setStreaming(true);

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

      if (!response.ok || !response.body) {
        // Failures before the stream opens still arrive as JSON.
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not draft that.");
        return;
      }

      // The context the model was given, for storing alongside a kept draft.
      const header = response.headers.get("x-draft-context");
      if (header) setContext(atob(header));

      /*
       * Read the stream and split on the first blank line.
       *
       * Everything before it is the subject, everything after is the body, and
       * until that line arrives the whole accumulation is still subject. That
       * ordering is why the header comes first in the format: the subject
       * settles in the first few tokens and stops moving, so the body can grow
       * underneath it without the layout jumping.
       */
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });

        const error = text.indexOf("[[error]]");
        if (error !== -1) {
          setError(text.slice(error + "[[error]]".length).trim());
          text = text.slice(0, error);
        }

        const split = text.indexOf("\n\n");
        if (split === -1) {
          setSubject(text.replace(/^Subject:\s*/i, "").trim());
        } else {
          setSubject(text.slice(0, split).replace(/^Subject:\s*/i, "").trim());
          setBody(text.slice(split + 2).replace(/^\s+/, ""));
        }
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setStreaming(false);
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

  async function toGmail() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/outreach/gmail-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          applicationId: applicationId || null,
          to: contactEmail,
          subject,
          body,
          context,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not create the draft.");
        return;
      }
      // Kept here too, by the same request. Marking both means the buttons
      // stop inviting a second copy of the same message.
      setInGmail(true);
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Set here and nowhere else. The route rejects anything without it,
          // so a caller that has not been through this screen cannot send.
          confirmed: true,
          contactId,
          applicationId: applicationId || null,
          to: contactEmail,
          subject,
          body,
          context,
        }),
      });
      const data = (await response.json()) as { error?: string; from?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not send.");
        setReviewing(false);
        return;
      }
      setSent(data.from ?? contactEmail);
      setReviewing(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setReviewing(false);
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

      {!reviewing && !sent && (
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
      )}

      {!reviewing && !sent && (
      <div className="flex flex-wrap items-center gap-compact">
        <button
          type="button"
          onClick={draft}
          disabled={busy}
          className="rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {streaming ? "Writing…" : busy ? "Working…" : body ? "Regenerate" : "Draft"}
        </button>
        {body && !streaming && (
          <span className="text-caption text-content-tertiary">
            {body.split(/\s+/).filter(Boolean).length} words
          </span>
        )}
      </div>
      )}

      {error && (
        <p role="alert" className="text-caption text-badge-clay-fg">
          {error}
        </p>
      )}

      {(body || subject || streaming) && !reviewing && !sent && (
        <div className="flex flex-col gap-compact border-t border-border-subtle pt-compact">
          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            Subject
            <input
              value={subject}
              readOnly={streaming}
              onChange={(e) => {
                setSubject(e.target.value);
                setSaved(false);
                setInGmail(false);
              }}
              className={field}
            />
          </label>

          {/*
            Two renderings of the same text, and the swap is the point.

            While streaming it is prose in a div, so paragraphs land as they are
            written and the whole thing reads as it arrives. A textarea would
            technically work and would feel wrong: a caret parked in front of
            text that keeps appearing, in a control that invites typing into
            something not finished being written.

            Once the stream closes it becomes the textarea, because now the job
            is editing. aria-live announces the finished draft rather than every
            token — polite on a value that changes forty times a second is noise.
          */}
          <label className="flex flex-col gap-tight text-caption text-content-tertiary">
            Body
            {streaming ? (
              <div
                aria-busy="true"
                className={`${field} min-h-56 whitespace-pre-wrap leading-relaxed`}
              >
                {body}
                <span
                  aria-hidden="true"
                  className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-content-primary"
                />
              </div>
            ) : (
              <textarea
                rows={12}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSaved(false);
                  setInGmail(false);
                }}
                className={`${field} resize-y leading-relaxed`}
              />
            )}
          </label>

          {!streaming && (
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
              Gmail when it is connected, the mail client when it is not.
              Both are shown as one slot rather than two, because they are the
              same intention and offering both at once would only ask you to
              pick between a good route and a worse one.

              Sending is behind Review and send; the Gmail draft is kept
              alongside it for the times you want to finish in Gmail — add an
              attachment, cc someone, sit on it overnight. Neither is the
              default-on path: nothing leaves without the review screen.
            */}
            {gmailConnected ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setReviewing(true);
                  }}
                  disabled={busy || !body.trim() || !contactEmail}
                  className="rounded-subtle bg-coral-default px-body py-compact text-small font-semibold leading-none text-content-primary transition-colors hover:bg-coral-hover disabled:opacity-50"
                >
                  Review and send
                </button>
                <button
                  type="button"
                  onClick={toGmail}
                  disabled={busy || inGmail}
                  className="rounded-subtle border border-border-default bg-surface-sunken px-body py-compact text-small font-medium leading-none text-content-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {inGmail ? "In your Gmail drafts ✓" : busy ? "Creating…" : "Save to Gmail drafts"}
                </button>
              </>
            ) : (
              <a
                href={mailto}
                className="rounded-subtle bg-coral-default px-body py-compact text-small font-semibold leading-none text-content-primary transition-colors hover:bg-coral-hover"
              >
                Open in mail
              </a>
            )}

            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(`${subject}\n\n${body}`)}
              className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
            >
              Copy
            </button>
          </div>
          )}
        </div>
      )}

      {/*
        The review.
        
        It is a separate screen rather than a confirm dialog over the editor,
        and everything that is about to be true is on it: the address it leaves
        from, the person it arrives at with their address spelled out, the
        subject, and the entire body — not a preview of the body, all of it, no
        scroll box hiding the last paragraph. The thing you skim is the thing
        that goes.

        Nothing here is editable. An editable review is not a review; it is the
        editor with a Send button, and the pause it is supposed to create
        disappears. Back to editing is one press away and loses nothing.
      */}
      {reviewing && (
        <div className="flex flex-col gap-body border-t border-border-subtle pt-body">
          <div className="flex flex-col gap-tight">
            <h3 className="text-small font-semibold text-content-primary">
              Send this?
            </h3>
            <p className="text-caption text-content-tertiary">
              This goes out from your Gmail as soon as you press send. There is
              no recall.
            </p>
          </div>

          <dl className="flex flex-col gap-tight rounded-default border border-border-subtle bg-surface-sunken px-default py-compact text-caption">
            <div className="flex gap-compact">
              <dt className="w-12 shrink-0 text-content-tertiary">From</dt>
              <dd className="min-w-0 truncate text-content-secondary">
                {gmailAddress ?? "your connected Gmail"}
              </dd>
            </div>
            <div className="flex gap-compact">
              <dt className="w-12 shrink-0 text-content-tertiary">To</dt>
              <dd className="min-w-0 truncate text-content-primary">
                {contactName} &lt;{contactEmail}&gt;
              </dd>
            </div>
            <div className="flex gap-compact">
              <dt className="w-12 shrink-0 text-content-tertiary">Subject</dt>
              <dd className="min-w-0 text-content-primary">
                {subject.trim() || (
                  <span className="text-badge-amber-fg">(no subject)</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="whitespace-pre-wrap rounded-default border border-border-subtle bg-surface-base px-default py-compact text-body leading-relaxed text-content-primary">
            {body}
          </div>

          <div className="flex flex-wrap items-center gap-compact">
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy}
              className="rounded-subtle bg-coral-default px-body py-compact text-small font-semibold leading-none text-content-primary transition-colors hover:bg-coral-hover disabled:opacity-50"
            >
              {busy ? "Sending…" : `Send to ${contactName.split(" ")[0]}`}
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={busy}
              className="rounded-subtle border border-border-default bg-surface-sunken px-body py-compact text-small font-medium leading-none text-content-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              Back to editing
            </button>
          </div>
        </div>
      )}

      {sent && (
        <div className="flex flex-col gap-compact border-t border-border-subtle pt-body">
          <p className="text-body text-content-primary">
            Sent to {contactName} from {sent}.
          </p>
          <p className="text-caption text-content-tertiary">
            It is in your Gmail sent folder, and kept here under this contact.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setSubject("");
              setBody("");
              setSaved(false);
              setInGmail(false);
            }}
            className="self-start text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
          >
            Write another
          </button>
        </div>
      )}
    </section>
  );
}
