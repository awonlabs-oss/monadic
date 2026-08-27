import { listContacts } from "@/lib/data/contacts";
import { getServerClient } from "@/lib/supabase/server";
import { ContactList } from "@/components/contact-list";
import { AddContact } from "@/components/add-contact";

/*
 * /contacts — the people half of the search.
 *
 * The tracker answers "where does this application stand". This answers "who
 * do I know there, and what have I already said to them". They are deliberately
 * separate pages: a contact outlives any one application, which is why the
 * schema hangs a contact off a company rather than off an application.
 */

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const db = await getServerClient();
  const [contacts, companies] = await Promise.all([
    listContacts(),
    db
      .from("companies")
      .select("id, name")
      .eq("ats_resolution_status", "resolved")
      .order("name"),
  ]);

  const withEmail = contacts.filter((c) => c.email).length;

  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <header className="flex flex-wrap items-start justify-between gap-snug">
        <div className="flex flex-col gap-tight">
          <h1 className="font-display text-display font-semibold italic leading-tight tracking-tight text-content-primary">
            Contacts
          </h1>
          <p className="text-body text-content-secondary">
            {contacts.length === 0
              ? "Nobody yet."
              : `${contacts.length} ${contacts.length === 1 ? "person" : "people"} · ${withEmail} with an email`}
          </p>
        </div>

        <AddContact companies={companies.data ?? []} />
      </header>

      <ContactList contacts={contacts} companies={companies.data ?? []} />
    </div>
  );
}
