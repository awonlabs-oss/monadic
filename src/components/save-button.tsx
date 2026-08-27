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
 * previous visit renders as saved on first paint with no request at all.
 *
 * The saved state is the icon alone. "Save" needs its label — it is a call to
 * action and a bare bookmark on a card full of controls is a guess — but once
 * the answer is yes, the word is repeating what the filled bookmark already
 * says, twice per row, on the majority of a feed you have been through. The
 * icon keeps its accessible name and a tooltip, so nothing is lost to anyone
 * reading it with a screen reader or hovering it.
 *
 * The control does get narrower on press, which moves Apply left. That is real
 * and it is the right trade: the alternative is padding the saved state out to
 * the width of a word that is no longer there, which reads as a button with
 * something missing from it.
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
  /*
   * A square whose height matches the labelled controls beside it, so the
   * saved state sits on the same baseline as Apply rather than becoming a
   * shorter chip. py-compact plus the icon is what sets that height, and the
   * matching horizontal padding makes it square rather than a narrow slot.
   */
  const square = "px-compact py-compact";

  if (saved) {
    const label = `Saved — ${jobTitle} at ${companyName}. Open in Tracked`;
    return (
      <Link
        href="/applications"
        aria-label={label}
        title="Saved"
        className={`inline-flex items-center justify-center rounded-subtle border border-border-default bg-surface-sunken ${square} text-content-primary transition-colors hover:bg-surface-hover`}
      >
        <BookmarkIcon className="size-icon-sm shrink-0" />
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
