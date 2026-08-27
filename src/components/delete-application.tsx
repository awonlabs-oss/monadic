"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Remove a tracked application, behind one confirmation.
 *
 * Two presses rather than a modal. What is being destroyed is one row and its
 * timeline — real, but small and re-creatable by pressing Save on the posting
 * again — so a dialog that takes over the screen would be heavier than the act.
 * The second press is labelled with what it does, not "Yes", so a stray click
 * on a row you did not mean to touch still reads as a warning.
 *
 * The row disappears on success because the server is told to revalidate and
 * the router refreshes; there is no optimistic removal, since a delete that
 * failed and left a hole would be worse than one that takes a moment.
 */
export function DeleteApplication({
  applicationId,
  title,
  companyName,
}: {
  applicationId: string;
  title: string;
  companyName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/applications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Could not delete.");
        setBusy(false);
        setConfirming(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (error) {
    return <span className="text-caption text-badge-clay-fg">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Remove ${title} at ${companyName} from tracked`}
        className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
      >
        Remove
      </button>
    );
  }

  return (
    <span className="flex items-center gap-tight">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-tag bg-badge-clay-bg px-tight py-hair text-caption font-medium text-badge-clay-fg transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {busy ? "Removing…" : "Remove from tracked"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
      >
        Keep
      </button>
    </span>
  );
}
