"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "./company-logo";
import { ContactForm } from "./contact-form";
import { deleteContactAction } from "@/app/contacts/actions";
import { ROLE_LABELS, type ContactRole } from "@/lib/contacts/roles";
import type { ContactRow } from "@/lib/data/contacts";

/**
 * The people list.
 *
 * Editing happens in place rather than on a detail page. A contact is six
 * short fields; a round trip to its own screen to fix a job title would be the
 * heavier half of the interaction.
 */
export function ContactList({
  contacts,
  companies,
}: {
  contacts: ContactRow[];
  companies: Array<{ id: string; name: string }>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (contacts.length === 0) {
    return (
      <p className="text-body text-content-secondary">
        No contacts yet. Add the recruiter or hiring manager for a role you are
        chasing, and you can draft outreach to them from here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-compact">
      {contacts.map((contact) => {
        const isEditing = editing === contact.id;
        return (
          <li
            key={contact.id}
            className="rounded-default border border-border-subtle bg-surface-base px-default py-body shadow-raised"
          >
            {isEditing ? (
              <ContactForm
                companies={companies}
                contact={contact}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-start gap-body">
                <CompanyLogo
                  name={contact.company?.name ?? contact.full_name}
                  src={contact.company?.logo_url ?? null}
                  size="small"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-row">
                  <p className="flex min-w-0 flex-wrap items-center gap-row text-small leading-none">
                    <span className="font-semibold text-content-primary">
                      {contact.full_name}
                    </span>
                    {contact.role && (
                      <span className="rounded-tag border border-border-subtle bg-surface-canvas px-chip py-xtight text-caption font-medium text-content-secondary">
                        {ROLE_LABELS[contact.role as ContactRole] ?? contact.role}
                      </span>
                    )}
                  </p>

                  <p className="truncate text-caption text-content-secondary">
                    {[contact.title, contact.company?.name].filter(Boolean).join(" · ") ||
                      "No title or company yet"}
                  </p>

                  <p className="flex flex-wrap items-center gap-compact text-caption text-content-tertiary">
                    {contact.email ? (
                      <span className="truncate">{contact.email}</span>
                    ) : (
                      <span>No email — needed to draft outreach</span>
                    )}
                    {contact.message_count > 0 && (
                      <span>
                        {contact.message_count}{" "}
                        {contact.message_count === 1 ? "message" : "messages"}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-compact">
                  {contact.email && (
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="rounded-subtle bg-coral-default px-default py-compact text-small font-semibold leading-none text-content-primary transition-colors hover:bg-coral-hover"
                    >
                      Draft outreach
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(contact.id)}
                    className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
                  >
                    Edit
                  </button>

                  {confirming === contact.id ? (
                    <form action={deleteContactAction} className="flex items-center gap-tight">
                      <input type="hidden" name="id" value={contact.id} />
                      <button
                        type="submit"
                        className="rounded-tag bg-badge-clay-bg px-tight py-hair text-caption font-medium text-badge-clay-fg"
                      >
                        {/* Named, because it takes the outreach with it. */}
                        Delete and its messages
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="text-caption text-content-tertiary underline underline-offset-2"
                      >
                        Keep
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(contact.id)}
                      className="text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
