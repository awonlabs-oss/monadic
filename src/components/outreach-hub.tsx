"use client";

import { useState } from "react";
import Link from "next/link";
import { ROLE_LABELS, type ContactRole } from "@/lib/contacts/roles";
import { linkContactAction, unlinkContactAction } from "@/app/(app)/applications/actions";
import { ComposePanel } from "./compose-panel";

/**
 * The people side of one application: who is here, and the panel that writes
 * to them.
 *
 * Two groups in one list rather than two lists. "In this process" are the
 * people already attached; below them, everyone else at the same company that
 * the contacts table already knows about. The second group is the reason this
 * is not just a rendering of the join table — a contact hangs off a company, so
 * the recruiter from a previous role at this company is already on file, and a
 * hub that only showed the join would make you go and find them.
 *
 * Only one composer is open at a time. Drafting is a paragraph of attention and
 * three open panels would be three half-written emails competing for it; the
 * open one also carries the previous messages to that person, which is context
 * that only makes sense one contact at a time.
 *
 * A contact with no email address gets no Draft button. Everything downstream
 * — the Gmail draft, the send review — needs somewhere to send it, and a
 * composer that can produce text but never deliver it is a worse answer than
 * the line telling you what is missing.
 */

export interface HubContact {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  role: string | null;
  role_in_process: string | null;
  linked: boolean;
  messages_here: number;
}

function roleLabel(role: string | null): string | null {
  if (!role) return null;
  return ROLE_LABELS[role as ContactRole] ?? role;
}

/**
 * One person, and their composer.
 *
 * Defined at module scope rather than inside OutreachHub, which is not a style
 * preference. A component declared inside another is a new function identity on
 * every render, so React unmounts and remounts its whole subtree whenever the
 * parent's state changes — and the subtree here contains a half-written email.
 * Pressing "Add to this role" on a second contact would have silently thrown
 * away the draft open above it.
 */
function ContactRow({
  contact,
  open,
  working,
  onToggle,
  onLink,
  onUnlink,
  applicationId,
  applicationLabel,
  previousMessages,
  gmailConnected,
  gmailAddress,
}: {
  contact: HubContact;
  open: boolean;
  working: boolean;
  onToggle: () => void;
  onLink: () => void;
  onUnlink: () => void;
  applicationId: string;
  applicationLabel: string;
  previousMessages: Array<{ id: string; subject: string | null; created_at: string }>;
  gmailConnected: boolean;
  gmailAddress: string | null;
}) {
  const label = roleLabel(contact.role_in_process ?? contact.role);

  return (
      <li className="flex flex-col gap-compact rounded-default border border-border-subtle bg-surface-base px-default py-body">
        <div className="flex flex-wrap items-start justify-between gap-compact">
          <div className="flex min-w-0 flex-col gap-hair">
            <Link
              href={`/contacts/${contact.id}`}
              className="text-body font-medium leading-tight text-content-primary hover:underline hover:underline-offset-2"
            >
              {contact.full_name}
            </Link>
            <p className="text-caption leading-tight text-content-tertiary">
              {[contact.title, label].filter(Boolean).join(" · ") ||
                "No title yet"}
              {contact.messages_here > 0 && (
                <span className="text-content-secondary">
                  {" · "}
                  {contact.messages_here}{" "}
                  {contact.messages_here === 1 ? "message" : "messages"} here
                </span>
              )}
            </p>
            {!contact.email && (
              <p className="text-caption leading-tight text-content-tertiary">
                No email address — add one to draft to them.
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-compact">
            {contact.email && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="rounded-subtle bg-accent-default px-body py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
              >
                {open ? "Close" : "Draft"}
              </button>
            )}

            {contact.linked ? (
              <button
                type="button"
                onClick={onUnlink}
                disabled={working}
                className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary disabled:opacity-50"
              >
                {working ? "…" : "Remove"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onLink}
                disabled={working}
                className="rounded-subtle border border-border-subtle bg-surface-base px-body py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary disabled:opacity-50"
              >
                {working ? "Adding…" : "Add to this role"}
              </button>
            )}
          </div>
        </div>

        {open && contact.email && (
          <div className="border-t border-border-subtle pt-body">
            <ComposePanel
              contactId={contact.id}
              contactName={contact.full_name}
              contactEmail={contact.email}
              /*
                One option, already selected. The composer's picker is built for
                the contact page, where which role you are writing about is
                genuinely ambiguous; opened from here it is not, so it is handed
                the single answer rather than the list. The panel still renders
                the select — it keeps a "No specific role" choice, which is a
                real thing to want even here — but the default is right without
                anyone touching it, and that default is what makes the message
                land in this application's history.
              */
              applications={[{ id: applicationId, label: applicationLabel }]}
              previousMessages={previousMessages}
              gmailConnected={gmailConnected}
              gmailAddress={gmailAddress}
            />
          </div>
        )}
      </li>
  );
}

export function OutreachHub({
  applicationId,
  applicationLabel,
  contacts,
  previousMessages,
  gmailConnected,
  gmailAddress,
}: {
  applicationId: string;
  /** How this application reads in the composer's own picker. */
  applicationLabel: string;
  contacts: HubContact[];
  /** Everything written about this application, so each composer can offer that contact's share. */
  previousMessages: Array<{
    id: string;
    contact_id: string;
    subject: string | null;
    created_at: string;
  }>;
  gmailConnected: boolean;
  gmailAddress: string | null;
}) {
  const [composing, setComposing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const inProcess = contacts.filter((c) => c.linked);
  const elsewhere = contacts.filter((c) => !c.linked);

  const rowProps = (contact: HubContact) => ({
    open: composing === contact.id,
    working: busy === contact.id,
    onToggle: () =>
      setComposing(composing === contact.id ? null : contact.id),
    onLink: () => link(contact.id, contact.role),
    onUnlink: () => unlink(contact.id),
    applicationId,
    applicationLabel,
    // Sliced per contact here rather than inside the row, so the row receives
    // only what its own composer offers.
    previousMessages: previousMessages
      .filter((m) => m.contact_id === contact.id)
      .map((m) => ({ id: m.id, subject: m.subject, created_at: m.created_at })),
    gmailConnected,
    gmailAddress,
  });

  async function link(contactId: string, roleInProcess: string | null) {
    setBusy(contactId);
    try {
      const form = new FormData();
      form.set("applicationId", applicationId);
      form.set("contactId", contactId);
      if (roleInProcess) form.set("roleInProcess", roleInProcess);
      await linkContactAction(form);
    } finally {
      setBusy(null);
    }
  }

  async function unlink(contactId: string) {
    setBusy(contactId);
    try {
      const form = new FormData();
      form.set("applicationId", applicationId);
      form.set("contactId", contactId);
      await unlinkContactAction(form);
      if (composing === contactId) setComposing(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-body">
      {inProcess.length > 0 && (
        <ul className="flex flex-col gap-compact">
          {inProcess.map((c) => (
            <ContactRow key={c.id} contact={c} {...rowProps(c)} />
          ))}
        </ul>
      )}

      {elsewhere.length > 0 && (
        <div className="flex flex-col gap-compact">
          <h3 className="text-micro font-medium uppercase tracking-wide text-content-tertiary">
            Also at this company
          </h3>
          <ul className="flex flex-col gap-compact">
            {elsewhere.map((c) => (
              <ContactRow key={c.id} contact={c} {...rowProps(c)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
