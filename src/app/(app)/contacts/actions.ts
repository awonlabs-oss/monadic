"use server";

import { revalidatePath } from "next/cache";
import {
  CONTACT_ROLES,
  createContact,
  updateContact,
  deleteContact,
  type ContactRole,
  type ContactInput,
} from "@/lib/data/contacts";

/**
 * Contact writes.
 *
 * Server actions rather than route handlers, unlike Save and the status picker.
 * Those two exist as routes because a re-render of the page they were pressed
 * on was actively harmful — it tore the card out from under the cursor. Here
 * the re-render is the point: adding a contact should make the list contain it.
 */

function read(form: FormData): ContactInput {
  const s = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v ? v : null;
  };
  const role = s("role");
  return {
    fullName: String(form.get("fullName") ?? "").trim(),
    title: s("title"),
    email: s("email"),
    phone: s("phone"),
    linkedinUrl: s("linkedinUrl"),
    role: (CONTACT_ROLES as readonly string[]).includes(role ?? "")
      ? (role as ContactRole)
      : null,
    companyId: s("companyId"),
    notes: s("notes"),
  };
}

export async function createContactAction(form: FormData) {
  const input = read(form);
  if (!input.fullName) return;
  await createContact(input);
  revalidatePath("/contacts");
}

export async function updateContactAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  const input = read(form);
  if (!id || !input.fullName) return;
  await updateContact(id, input);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
}

export async function deleteContactAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await deleteContact(id);
  revalidatePath("/contacts");
}
