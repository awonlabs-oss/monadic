"use server";

import { revalidatePath } from "next/cache";
import { CONTACT_ROLES, linkContact, unlinkContact, type ContactRole } from "@/lib/data/contacts";

/**
 * Attaching people to an application.
 *
 * Server actions rather than route handlers, for the same reason the contact
 * writes are: the re-render is the point. Linking someone should make them move
 * to the top of the hub's list and grow a Draft button, and a route handler
 * would mean doing that twice — once optimistically in the client and once for
 * real.
 *
 * Both are idempotent at the database level. The join carries a unique
 * constraint and linkContact swallows the violation, so a double-press is one
 * row rather than an error, and unlinking something already gone is a no-op.
 */

function roleOf(form: FormData): ContactRole | null {
  const role = String(form.get("roleInProcess") ?? "").trim();
  return (CONTACT_ROLES as readonly string[]).includes(role)
    ? (role as ContactRole)
    : null;
}

export async function linkContactAction(form: FormData) {
  const applicationId = String(form.get("applicationId") ?? "");
  const contactId = String(form.get("contactId") ?? "");
  if (!applicationId || !contactId) return;

  await linkContact(applicationId, contactId, roleOf(form));

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/contacts");
}

export async function unlinkContactAction(form: FormData) {
  const applicationId = String(form.get("applicationId") ?? "");
  const contactId = String(form.get("contactId") ?? "");
  if (!applicationId || !contactId) return;

  // The contact itself survives, and so does anything written to them. This
  // says "not part of this process", not "no longer someone I know" — the
  // second is what deleting the contact is for, and it is destructive in a way
  // this is not.
  await unlinkContact(applicationId, contactId);

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/contacts");
}
