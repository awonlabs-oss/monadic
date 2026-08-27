"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * A listbox that replaces `<select>`.
 *
 * The reason it exists is narrow and real: a native select's *button* can be
 * styled, but its dropdown is drawn by the operating system and cannot be. No
 * amount of CSS reaches the option list, so on every platform it arrives as a
 * grey system menu in a system font — the one control in the app that ignores
 * the token layer entirely.
 *
 * The cost of replacing it is that everything the native control gave away for
 * free has to be rebuilt, and skipping that is how these end up worse than what
 * they replaced. So: a real `role="listbox"`, arrow keys, Home and End, Enter
 * and Space to commit, Escape to abandon, type-ahead, focus returned to the
 * trigger on close, `aria-activedescendant` pointing at the highlighted option,
 * and the open list dismissed by an outside press.
 *
 * The value rides in a hidden input, so this drops into a plain form — server
 * action or GET — with no client state plumbing around it.
 */

export interface SelectOption {
  value: string;
  label: string;
  /** Rendered under the label in the list, never in the trigger. */
  hint?: string;
}

const TYPEAHEAD_MS = 600;

export function Select({
  name,
  options,
  defaultValue,
  placeholder = "Select…",
  ariaLabel,
  className = "",
  onCommit,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Called after a choice is committed — used to submit the enclosing form. */
  onCommit?: (value: string) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ buffer: "", at: 0 });

  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === (defaultValue ?? "")),
    ),
  );

  const selected = options.find((o) => o.value === value) ?? null;

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) return;
      setValue(option.value);
      close();
      onCommit?.(option.value);
    },
    [options, close, onCommit],
  );

  // The highlighted option is scrolled into view rather than left offscreen,
  // which is what makes arrow-key navigation usable in a long list.
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
      if (
        root &&
        event.target instanceof Node &&
        !root.contains(event.target)
      ) {
        // No focus restore: the press already moved focus somewhere deliberate.
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    const last = options.length - 1;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
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
        // Tab commits nothing and lets focus continue, matching a native select.
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

    // Type-ahead. A single printable character starts or extends a buffer that
    // lapses after a beat, so "te" finds Technical rather than jumping twice.
    if (
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const now = Date.now();
      typed.current.buffer =
        now - typed.current.at > TYPEAHEAD_MS
          ? event.key.toLowerCase()
          : typed.current.buffer + event.key.toLowerCase();
      typed.current.at = now;

      const found = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(typed.current.buffer),
      );
      if (found >= 0) setActive(found);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-tight rounded-subtle border border-border-subtle bg-surface-base px-compact py-tight text-left text-body text-content-primary transition-colors hover:bg-surface-hover"
      >
        <span className={`truncate ${selected ? "" : "text-content-tertiary"}`}>
          {selected?.label ?? placeholder}
        </span>
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
          aria-label={ariaLabel}
          tabIndex={-1}
          className="absolute left-0 top-full z-20 mt-tight max-h-64 w-full min-w-max overflow-y-auto rounded-default border border-border-subtle bg-surface-base p-hair shadow-overlay"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(index)}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-start justify-between gap-compact rounded-tag px-compact py-tight text-body ${
                  index === active
                    ? "bg-surface-sunken text-content-primary"
                    : "text-content-secondary"
                }`}
              >
                <span className="flex min-w-0 flex-col gap-hair">
                  <span
                    className={
                      isSelected ? "font-medium text-content-primary" : ""
                    }
                  >
                    {option.label}
                  </span>
                  {option.hint && (
                    <span className="text-caption text-content-tertiary">
                      {option.hint}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="mt-micro size-icon-xs shrink-0 text-content-primary"
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
