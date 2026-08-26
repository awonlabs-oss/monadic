"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The Filters disclosure: the button, the popover, and the two behaviours that
 * need a client to exist at all.
 *
 * 1. The submit button counts live. Ticking a box updates "Show N roles" before
 *    anything is applied, so the choice is made against the number it produces
 *    rather than after it. The count comes from the server (see
 *    /api/job-count) because it cannot honestly be computed here.
 *
 * 2. Clicking away applies. A panel that discards what you just selected the
 *    moment you look elsewhere is the more surprising of the two options —
 *    every change in it is an explicit act, so dismissing is not a reason to
 *    throw them away. Clicking away with nothing changed just closes.
 *
 * The sections are passed in as children and stay server-rendered; only the
 * chrome around them is client-side.
 */

export interface HiddenField {
  name: string;
  value: string;
}

const DEBOUNCE_MS = 200;

function Chevron({ open }: { open: boolean }) {
  return (
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
  );
}

export function FilterDisclosure({
  active,
  defaultOpen,
  serverTotal,
  hidden,
  children,
}: {
  active: number;
  defaultOpen: boolean;
  serverTotal: number;
  hidden: HiddenField[];
  children: React.ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(defaultOpen);
  // State rather than a ref: it is read by the outside-click handler, and a ref
  // may not be written during the render that resets it after a navigation.
  const [dirty, setDirty] = useState(false);
  const [total, setTotal] = useState(serverTotal);
  const [counting, setCounting] = useState(false);

  // A navigation re-renders the panel with the applied filters. Whatever was
  // pending is now the truth, so the local count and the dirty flag reset to it
  // rather than surviving as a stale override.
  //
  // Adjusted during render rather than in an effect. An effect would paint the
  // stale count first and correct it on a second pass, and the correction is
  // the number on a button the user is looking at.
  const [lastServerTotal, setLastServerTotal] = useState(serverTotal);
  if (lastServerTotal !== serverTotal) {
    setLastServerTotal(serverTotal);
    setTotal(serverTotal);
    setDirty(false);
  }

  const recount = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === "string") params.append(k, v);
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setCounting(true);

    fetch(`/api/job-count?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { total: number }) => {
        setTotal(d.total);
        setCounting(false);
      })
      .catch((e: unknown) => {
        // An abort is the next keystroke superseding this one, not a failure.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setCounting(false);
      });
  }, []);

  function onChange() {
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(recount, DEBOUNCE_MS);
  }

  const applyOrClose = useCallback(() => {
    const details = detailsRef.current;
    if (!details?.open) return;
    if (dirty) formRef.current?.requestSubmit();
    else {
      details.open = false;
      setOpen(false);
    }
  }, [dirty]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open) return;
      const target = event.target;
      if (target instanceof Node && details.contains(target)) return;
      applyOrClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      // Escape dismisses without applying — the one way out that discards.
      if (event.key !== "Escape") return;
      const details = detailsRef.current;
      if (!details?.open) return;
      details.open = false;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [applyOrClose]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    [],
  );

  return (
    <details
      ref={detailsRef}
      open={defaultOpen}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="w-fit"
    >
      <summary className="flex w-fit list-none items-center gap-tight rounded-subtle border border-border-subtle bg-surface-base px-default py-compact text-small font-medium text-content-primary transition-colors hover:bg-surface-hover">
        <svg
          aria-hidden="true"
          viewBox="0 0 14 14"
          className="size-icon-sm shrink-0 text-content-secondary"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M1.5 3h11M3.5 7h7M6 11h2" />
        </svg>
        Filters
        {active > 0 && (
          <span className="rounded-tag bg-accent-default px-tight py-hairline text-caption tabular-nums text-content-inverse">
            {active}
          </span>
        )}
        <Chevron open={open} />
      </summary>

      <form
        ref={formRef}
        method="get"
        action="/jobs"
        onChange={onChange}
        className="filter-panel absolute left-0 top-full z-10 mt-tight flex flex-col gap-body rounded-default border border-border-subtle bg-surface-base p-default shadow-overlay"
      >
        {/*
          No `panel=1`. It used to be submitted so the panel survived applying;
          the panel now closes on apply, which is what the click that applied it
          was asking for.
        */}
        {hidden.map((f) => (
          <input key={`${f.name}:${f.value}`} type="hidden" name={f.name} value={f.value} />
        ))}

        {children}

        <div className="flex items-center justify-between gap-snug border-t border-border-subtle pt-default">
          <Link
            href="/jobs?reset=1&panel=1"
            className="rounded-subtle px-compact py-tight text-small text-content-secondary underline underline-offset-2 transition-colors hover:bg-surface-hover hover:text-content-primary"
          >
            Clear all
          </Link>
          <button
            type="submit"
            aria-live="polite"
            className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
          >
            {/*
              The number keeps its last known value while a recount is in
              flight, dimmed rather than replaced. Swapping it for a spinner on
              every keystroke makes the control flicker and tells you less.
            */}
            Show{" "}
            <span className={`tabular-nums ${counting ? "opacity-60" : ""}`}>
              {total.toLocaleString()}
            </span>{" "}
            {total === 1 ? "role" : "roles"}
          </button>
        </div>
      </form>
    </details>
  );
}
