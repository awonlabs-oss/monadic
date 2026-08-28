"use server";

import { revalidatePath } from "next/cache";
import { saveGuidelines, addExample, deleteExample } from "@/lib/data/voice";

/** Writes for the voice page. Re-rendering the list is the desired outcome. */

export async function saveGuidelinesAction(form: FormData) {
  await saveGuidelines(String(form.get("guidelines") ?? ""));
  revalidatePath("/voice");
}

export async function addExampleAction(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!name || !body) return;
  await addExample({
    name,
    subject: String(form.get("subject") ?? "").trim() || null,
    body,
  });
  revalidatePath("/voice");
}

export async function deleteExampleAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await deleteExample(id);
  revalidatePath("/voice");
}
