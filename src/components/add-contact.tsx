"use client";

import { useState } from "react";
import { ContactForm } from "./contact-form";

/** The add form, closed until asked for — same pattern as Add a link. */
export function AddContact({ companies }: { companies: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-subtle border border-border-subtle bg-surface-base px-body py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
      >
        Add a contact
      </button>
    );
  }

  return (
    <div className="w-full rounded-default border border-border-subtle bg-surface-base p-default">
      <ContactForm companies={companies} onDone={() => setOpen(false)} />
    </div>
  );
}
