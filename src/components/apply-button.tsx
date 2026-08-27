"use client";

import { SendIcon } from "./icons";

/**
 * Apply: open the company's board, and record that you did.
 *
 * It stayed a plain anchor for a long time and that was the bug. Pressing it
 * was the strongest statement of intent the app ever received and the only one
 * it discarded — the job sat in Saved afterwards, so the board disagreed with
 * what you had actually done.
 *
 * The navigation is untouched. This is still a real anchor with a real href
 * opening in a new tab, so middle-click, cmd-click and "copy link" all behave;
 * the write is fired alongside it and nothing waits on it. keepalive is set
 * because the browser is busy opening a tab at that moment and an in-flight
 * request must survive it.
 *
 * Marking applied is a claim about intent rather than proof of submission. The
 * status picker is one click away and reversible, which is a better failure
 * than a job you believe you never applied to.
 */
export function ApplyButton({
  jobId,
  jobTitle,
  companyName,
  url,
  size = "card",
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  url: string;
  size?: "card" | "page";
}) {
  const px = size === "page" ? "px-body" : "px-default";

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={() => {
        void fetch("/api/jobs/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
          keepalive: true,
        }).catch(() => {
          // Silent. The tab is already open and the posting is what matters;
          // the status is correctable from the board.
        });
      }}
      /*
        The one coral thing on a card. Apply is the only control here that
        leaves the app, and the accent marks that rather than decorating the
        row: ink for everything that keeps you inside, coral for the one that
        does not. Ink text on the coral, not white — see DESIGN.md section 1.
      */
      className={`inline-flex items-center gap-tight rounded-subtle bg-coral-default ${px} py-compact text-small font-semibold leading-none text-content-primary transition-colors hover:bg-coral-hover`}
    >
      <SendIcon className="size-icon-sm shrink-0" />
      Apply
      <span className="sr-only">
        {" "}
        to {jobTitle} at {companyName} on their site, opens in a new tab
      </span>
    </a>
  );
}
