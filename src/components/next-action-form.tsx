"use client";

import { useState } from "react";
import { setNextActionAction } from "@/app/actions";

/**
 * The one thing you have told yourself to do next, and when.
 *
 * A single line rather than a task list, and that is the whole design. A job
 * search generates an unbounded number of things you could do; what stalls an
 * application is not having too few of them but never deciding which one is
 * next. One field forces the decision. When it is done you write the one after
 * it, and the timeline keeps both.
 *
 * The date is what makes it a follow-up rather than a note: `next_action_at` in
 * the past is what the board reads to mark a row overdue, so a dateless action
 * is a reminder that can never fire. It stays optional anyway — "ask about
 * comp" with no date is still worth more than an empty field.
 *
 * Clearing both is a real intent and writes nulls, which is why the submit
 * label changes rather than the button disabling on an empty form.
 */
export function NextActionForm({
  applicationId,
  nextAction,
  nextActionAt,
  overdue,
}: {
  applicationId: string;
  nextAction: string | null;
  nextActionAt: string | null;
  overdue: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState(nextAction ?? "");
  const [date, setDate] = useState(nextActionAt?.slice(0, 10) ?? "");

  const field =
    "rounded-subtle border border-border-subtle bg-surface-canvas px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary";

  const clearing = action.trim() === "" && date === "";

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        try {
          await setNextActionAction(formData);
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-compact"
    >
      <input type="hidden" name="applicationId" value={applicationId} />

      <div className="flex flex-col gap-compact sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          <label
            htmlFor="nextAction"
            className="text-caption text-content-tertiary"
          >
            Next action
          </label>
          <input
            id="nextAction"
            name="nextAction"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Follow up with the recruiter"
            className={`${field} w-full`}
          />
        </div>

        <div className="flex flex-col gap-tight">
          <label
            htmlFor="nextActionAt"
            className="text-caption text-content-tertiary"
          >
            When
          </label>
          <input
            id="nextActionAt"
            name="nextActionAt"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Saving…" : clearing ? "Clear" : "Set"}
        </button>
      </div>

      {overdue && nextAction && (
        <p className="text-caption text-badge-amber-fg">
          Overdue. It has been sitting here since the date passed — do it, or
          move the date and say so on the timeline.
        </p>
      )}
    </form>
  );
}
