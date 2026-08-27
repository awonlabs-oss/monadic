"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Paste a link, get a tracked application.
 *
 * The form is closed until asked for. The board's job is to show what you are
 * running, and a permanently open input at the top of it would compete with
 * that for the sake of an action taken a few times a week.
 *
 * Three things get reported back, because all three are genuinely different
 * outcomes and collapsing them would be a small lie:
 *
 *   - added, read from the company's own board
 *   - added, read off the page
 *   - already tracked, which is not a failure and not a new row
 *
 * The wait is real — an unfamiliar link means fetching a page and reading it —
 * so the button says what is happening instead of spinning silently.
 *
 * router.refresh() on success rather than an optimistic insert: a new card
 * carries a status, a stage line, a logo and a timeline, and guessing all of
 * that to save one round trip would mean a card that visibly corrects itself.
 */
export function AddLink() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || busy) return;

    setBusy(true);
    setError(null);
    setDone(null);

    try {
      const response = await fetch("/api/applications/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as {
        error?: string;
        outcome?: "existing" | "created";
        title?: string;
        companyName?: string;
        via?: "board" | "page";
      };

      if (!response.ok) {
        setError(body.error ?? "Could not add that link.");
        return;
      }

      setDone(
        body.outcome === "existing"
          ? `Already tracked: ${body.title} at ${body.companyName}`
          : `Added ${body.title} at ${body.companyName}${body.via === "page" ? " — read from the page" : ""}`,
      );
      setUrl("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-subtle border border-border-subtle bg-surface-base px-body py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
      >
        Add a link
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base p-default"
    >
      <label htmlFor="manual-url" className="text-caption text-content-tertiary">
        Paste a job link. A posting from a board monadic already reads is pulled from
        that board; anything else is read from the page.
      </label>

      <div className="flex flex-wrap items-center gap-compact">
        <input
          id="manual-url"
          type="url"
          required
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://jobs.ashbyhq.com/company/…"
          className="min-w-0 flex-1 rounded-subtle border border-border-subtle bg-surface-base px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Reading the posting…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setDone(null);
          }}
          className="rounded-subtle px-compact py-compact text-small leading-none text-content-tertiary transition-colors hover:text-content-primary"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-caption text-badge-clay-fg">{error}</p>}
      {done && <p className="text-caption text-signal-default">{done}</p>}
    </form>
  );
}
