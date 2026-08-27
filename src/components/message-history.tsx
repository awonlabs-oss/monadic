"use client";

import { useState } from "react";
import type { OutreachMessage } from "@/lib/data/outreach";

/**
 * What has already been written to this person.
 *
 * Kept because the second email is easier with the first in front of you, and
 * because a month later "did I already email them" is a real question with an
 * expensive wrong answer. Drafts that were never sent are shown too — for
 * reuse they are worth the same as one that went out.
 */
export function MessageHistory({ messages }: { messages: OutreachMessage[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (messages.length === 0) {
    return (
      <section className="flex flex-col gap-compact border-t border-border-subtle pt-default">
        <h2 className="text-small font-medium text-content-primary">History</h2>
        <p className="text-caption text-content-tertiary">
          Nothing written yet. Kept drafts appear here and can be used to match
          the voice of the next one.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-compact border-t border-border-subtle pt-default">
      <h2 className="text-small font-medium text-content-primary">
        History
        <span className="pl-tight tabular-nums text-content-tertiary">{messages.length}</span>
      </h2>

      <ul className="flex flex-col gap-compact">
        {messages.map((m) => {
          const expanded = open === m.id;
          return (
            <li
              key={m.id}
              className="rounded-default border border-border-subtle bg-surface-base px-default py-body"
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : m.id)}
                aria-expanded={expanded}
                className="flex w-full items-start justify-between gap-compact text-left"
              >
                <span className="flex min-w-0 flex-col gap-hair">
                  <span className="truncate text-body font-medium text-content-primary">
                    {m.subject || "No subject"}
                  </span>
                  <span className="text-caption text-content-tertiary">
                    {m.sent_at
                      ? `Sent ${new Date(m.sent_at).toLocaleDateString()}`
                      : `Draft · kept ${new Date(m.created_at).toLocaleDateString()}`}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-content-tertiary">
                  {expanded ? "Hide" : "Read"}
                </span>
              </button>

              {expanded && (
                <p className="mt-compact whitespace-pre-wrap border-t border-border-subtle pt-compact text-body leading-relaxed text-content-secondary">
                  {m.body}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
