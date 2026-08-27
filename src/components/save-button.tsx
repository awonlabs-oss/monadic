"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkIcon } from "./icons";

/**
 * Save, and then say Saved.
 *
 * The button used to be a form posting a server action. That was correct and
 * slow: a round trip, a re-render of the whole route, and only then a control
 * that had changed. On /for-you it was worse than slow — the re-render dropped
 * the card, because recommend_jobs excludes saved jobs, so pressing Save made
 * the thing you had just decided to keep vanish.
 *
 * So the state moves here. The label flips on press, before the request is
 * sent, and the request goes to a route handler that writes without
 * re-rendering the page. The card stays where it is and the feed drops it on
 * the next visit, which is what excluding it was for.
 *
 * A failed write reverts the label. Nothing else reports it: this is one
 * person's job feed, the retry is pressing the button again, and a toast for a
 * failed bookmark is more apparatus than the failure deserves.
 *
 * `saved` is the server's answer and is the initial state, so a job saved on a
 * previous visit renders as Saved on first paint with no request at all.
 */
export function SaveButton({
  jobId,
  jobTitle,
  companyName,
  saved: initiallySaved,
  size = "card",
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  saved: boolean;
  /** The detail page sets its controls a step wider than the feed card does. */
  size?: "card" | "page";
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const px = size === "page" ? "px-body" : "px-default";

  if (saved) {
    return (
      <Link
        href="/applications"
        className={`inline-flex items-center gap-tight rounded-subtle border border-border-default bg-surface-sunken ${px} py-compact text-small font-medium leading-none text-content-primary transition-colors hover:bg-surface-hover`}
      >
        <BookmarkIcon className="size-icon-sm shrink-0" />
        Saved
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Save ${jobTitle} at ${companyName}`}
      onClick={async () => {
        // Flipped first, deliberately. The write takes a few hundred
        // milliseconds and the answer is known before it starts.
        setSaved(true);
        try {
          const response = await fetch("/api/jobs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });
          if (!response.ok) setSaved(false);
        } catch {
          setSaved(false);
        }
      }}
      className={`inline-flex items-center gap-tight rounded-subtle border border-border-subtle bg-surface-base ${px} py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary`}
    >
      <BookmarkIcon className="size-icon-sm shrink-0" />
      Save
    </button>
  );
}
