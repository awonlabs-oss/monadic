"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { StatusBadge } from "./status-badge";
import { ALL_STATUSES, STATUS_LABELS, type Status } from "@/lib/applications/pipeline";

/**
 * Changing an application's status, as badges rather than a dropdown.
 *
 * The old control was the generic Select wearing status names: a text trigger,
 * a text list, and none of the iconography the StatusBadge component already
 * defines for all nine variants. Reading "Onsite" in a list told you nothing
 * that the badge's own glyph and tone do not say faster, and the picker looked
 * like a form field in a view that has no other form fields.
 *
 * So the trigger *is* the badge, and every option is the badge you will get.
 * Choosing is recognition rather than reading, and what you point at is exactly
 * what appears afterwards.
 *
 * It also fixes a real bug. The Select wrote its value into a hidden input via
 * React state and then called requestSubmit() in the same handler — before
 * React had flushed the re-render, so the form posted the *previous* status and
 * the server dutifully set it to what it already was. Every change silently did
 * nothing. There is no hidden input here: the chosen value is passed straight
 * to the request, so there is no render to be ahead of.
 *
 * The keyboard behaviour the Select had is kept, because losing it would be a
 * regression: arrows, Home/End, Enter and Space to commit, Escape to abandon,
 * focus returned to the trigger, aria-activedescendant on the highlighted row,
 * and an outside press to dismiss.
 */
export function StatusPicker({
  applicationId,
  status: serverStatus,
}: {
  applicationId: string;
  status: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [status, setStatus] = useState(serverStatus);
  const [open, setOpen] = useState(false);

  /*
   * useState only reads its argument on the first render, so a picker that
   * stayed mounted while the server sent down a new status would keep showing
   * the old one — the board refreshing around it, and this control quietly
   * disagreeing with the row it belongs to. Tracking the last server value and
   * comparing during render is React's own answer to that, and it resynchronises
   * before paint rather than in an effect afterwards.
   *
   * The optimistic write is unaffected: it changes `status` while `serverStatus`
   * is unchanged, so nothing here fires until the server actually reports
   * something different.
   */
  const [lastServerStatus, setLastServerStatus] = useState(serverStatus);
  if (serverStatus !== lastServerStatus) {
    setLastServerStatus(serverStatus);
    setStatus(serverStatus);
  }

  const [active, setActive] = useState(() =>
    Math.max(0, ALL_STATUSES.indexOf(serverStatus as Status)),
  );

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const next = ALL_STATUSES[index];
      if (!next) return;
      close();
      if (next === status) return;

      // Optimistic, and the previous value is captured here rather than read
      // back from state, so a failed request reverts to what was actually on
      // screen instead of whatever the newest press left behind.
      const previous = status;
      setStatus(next);

      void (async () => {
        try {
          const response = await fetch("/api/applications/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applicationId, status: next }),
          });
          if (!response.ok) setStatus(previous);
        } catch {
          setStatus(previous);
        }
      })();
    },
    [applicationId, status, close],
  );

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    const last = ALL_STATUSES.length - 1;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        setActive(Math.max(0, ALL_STATUSES.indexOf(status as Status)));
        setOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab":
        setOpen(false);
        return;
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
        event.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(active);
        return;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-label={`Application status: ${STATUS_LABELS[status as Status] ?? status}`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => {
          setActive(Math.max(0, ALL_STATUSES.indexOf(status as Status)));
          setOpen((o) => !o);
        }}
        onKeyDown={onKeyDown}
        className="inline-flex items-center gap-tight rounded-subtle transition-opacity hover:opacity-80"
      >
        <StatusBadge status={status as Status} />
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`size-icon-xs shrink-0 text-content-tertiary transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label="Application status"
          tabIndex={-1}
          className="absolute left-0 top-full z-20 mt-tight w-max overflow-y-auto rounded-default border border-border-subtle bg-surface-base p-hair shadow-overlay"
        >
          {ALL_STATUSES.map((option, index) => (
            <li
              key={option}
              id={`${id}-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={option === status}
              onClick={() => commit(index)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-compact rounded-tag px-tight py-tight ${
                index === active ? "bg-surface-sunken" : ""
              }`}
            >
              <StatusBadge status={option} />
              {option === status && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="size-icon-xs shrink-0 text-content-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.5 6.5 5 9l4.5-5.5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
