"use client";

import { useState } from "react";

/**
 * The dock's collapse control.
 *
 * A client component wrapping server-rendered children, so the profile data
 * itself is still fetched and rendered on the server — only the open/closed
 * state lives here.
 *
 * The initial state comes from a cookie read on the server and passed in as a
 * prop, rather than from localStorage read after hydration. Reading it on the
 * client would render the dock open on every load and then snap it shut, which
 * is a worse first paint than the round trip is worth. Writing goes back to the
 * same cookie directly: this is a display preference, and routing it through a
 * server action would make collapsing the panel a network request.
 *
 * The brief says the dock is permanent and that where it sits becomes a
 * setting later; this is the interim affordance the frame shows, not that
 * setting.
 */
export function DockShell({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    // A year, path-wide, lax: it is a layout preference and nothing else.
    document.cookie = `dock=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      aria-label="Profile"
      className={`shrink-0 border-l border-border-subtle bg-surface-base ${
        open ? "w-dock" : "w-auto"
      }`}
    >
      <div
        className={`sticky top-0 flex max-h-screen flex-col gap-comfortable overflow-y-auto py-dock-y ${
          open ? "px-dock-x" : "px-compact"
        }`}
      >
        <div className="flex items-center justify-between gap-snug">
          {open && (
            <h2 className="text-lead font-semibold tracking-snug text-content-primary">
              Profile
            </h2>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Collapse the profile panel" : "Expand the profile panel"}
            className="shrink-0 rounded-subtle border border-border-subtle bg-surface-base p-row text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 13 13"
              className={`size-icon-sm ${open ? "" : "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 2.5 9 6.5 4.5 10.5" />
            </svg>
          </button>
        </div>

        {open && children}
      </div>
    </aside>
  );
}
