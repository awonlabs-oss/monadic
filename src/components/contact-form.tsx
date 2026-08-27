"use client";

import { useState } from "react";
import { CONTACT_ROLES, ROLE_LABELS } from "@/lib/contacts/roles";
import type { ContactRow } from "@/lib/data/contacts";
import { createContactAction, updateContactAction } from "@/app/contacts/actions";

/**
 * Add or edit a person.
 *
 * Only the name is required, and that is deliberate rather than lax. A contact
 * usually arrives as half a fact — a name on a job posting, a name in a
 * referral — and a form that demands an email before it will remember them at
 * all is a form you work around by not using it. Everything else can be filled
 * in when it is known.
 */
export function ContactForm({
  companies,
  contact,
  onDone,
}: {
  companies: Array<{ id: string; name: string }>;
  /** Present when editing. */
  contact?: ContactRow;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const editing = Boolean(contact);

  const field =
    "rounded-subtle border border-border-subtle bg-surface-canvas px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary";
  const label = "text-caption text-content-tertiary";

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        try {
          if (editing) await updateContactAction(formData);
          else await createContactAction(formData);
          onDone?.();
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-compact"
    >
      {editing && <input type="hidden" name="id" value={contact!.id} />}

      <div className="grid grid-cols-1 gap-compact sm:grid-cols-2">
        <div className="flex flex-col gap-tight">
          <label htmlFor="fullName" className={label}>Name</label>
          <input id="fullName" name="fullName" required autoFocus={!editing}
            defaultValue={contact?.full_name ?? ""}
            placeholder="Dana Wu" className={field} />
        </div>

        <div className="flex flex-col gap-tight">
          <label htmlFor="title" className={label}>Title</label>
          <input id="title" name="title" defaultValue={contact?.title ?? ""}
            placeholder="Technical Recruiter" className={field} />
        </div>

        <div className="flex flex-col gap-tight">
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" name="email" type="email" defaultValue={contact?.email ?? ""}
            placeholder="dana@company.com" className={field} />
        </div>

        <div className="flex flex-col gap-tight">
          <label htmlFor="role" className={label}>Relationship</label>
          <select id="role" name="role" defaultValue={contact?.role ?? ""} className={field}>
            <option value="">Not set</option>
            {CONTACT_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-tight">
          <label htmlFor="companyId" className={label}>Company</label>
          {/*
            Chosen from companies already ingested rather than typed. A contact
            whose company is a free-text string cannot be shown next to that
            company's jobs, which is most of why the link exists.
          */}
          <select id="companyId" name="companyId" defaultValue={contact?.company_id ?? ""} className={field}>
            <option value="">Not set</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-tight">
          <label htmlFor="linkedinUrl" className={label}>LinkedIn</label>
          <input id="linkedinUrl" name="linkedinUrl" defaultValue={contact?.linkedin_url ?? ""}
            placeholder="linkedin.com/in/…" className={field} />
        </div>
      </div>

      <div className="flex flex-col gap-tight">
        <label htmlFor="notes" className={label}>Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={contact?.notes ?? ""}
          placeholder="Met at the NYC meetup. Owns the FDE req."
          className={`${field} resize-y`} />
      </div>

      <div className="flex items-center gap-compact pt-tight">
        <button type="submit" disabled={busy}
          className="rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover disabled:opacity-50">
          {busy ? "Saving…" : editing ? "Save changes" : "Add contact"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone}
            className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
