import Link from "next/link";
import { notFound } from "next/navigation";
import { getContact, ROLE_LABELS, type ContactRole } from "@/lib/data/contacts";
import { listMessagesForContact } from "@/lib/data/outreach";
import { getServerClient } from "@/lib/supabase/server";
import { CompanyLogo } from "@/components/company-logo";
import { ComposePanel } from "@/components/compose-panel";
import { MessageHistory } from "@/components/message-history";
import { connectedAccount } from "@/outreach/gmail";

/*
 * One contact: who they are, what has been written to them, and the panel that
 * writes the next one.
 *
 * The applications offered to the panel are the ones at this contact's company.
 * That is the useful default and it is not a guess — a recruiter at Ramp is
 * writing about a Ramp role — and it saves the join table being the only way to
 * associate the two before any outreach exists.
 */

export const dynamic = "force-dynamic";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) notFound();

  const db = await getServerClient();
  const [messages, applications, gmail] = await Promise.all([
    listMessagesForContact(id),
    contact.company_id
      ? db
          .from("applications")
          .select("id, jobs(title, companies(name))")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    connectedAccount(),
  ]);

  // Narrowed to this contact's company where there is one, so the dropdown is
  // short and relevant rather than every application ever opened.
  const options = ((applications.data ?? []) as unknown as Array<{
    id: string;
    jobs: { title: string; companies: { name: string } | null } | null;
  }>)
    .filter((a) => !contact.company?.name || a.jobs?.companies?.name === contact.company.name)
    .map((a) => ({
      id: a.id,
      label: `${a.jobs?.title ?? "Untitled"}${a.jobs?.companies?.name ? ` · ${a.jobs.companies.name}` : ""}`,
    }));

  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <header className="flex flex-col gap-snug">
        <Link
          href="/contacts"
          className="w-fit text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
        >
          All contacts
        </Link>

        <div className="flex items-start gap-body">
          <CompanyLogo
            name={contact.company?.name ?? contact.full_name}
            src={contact.company?.logo_url ?? null}
            size="card"
          />
          <div className="flex min-w-0 flex-col gap-tight">
            {/*
              Not the display serif. Every other h1 in the app names a *page* —
              "Tracked", "For You" — and the serif marks that. This one is a
              person's name, which is data, and the rule DESIGN.md section 1
              states is that the serif never touches data. It read as a page
              called "Dana Wu".
            */}
            <h1 className="text-title font-semibold leading-tight tracking-tight text-content-primary">
              {contact.full_name}
            </h1>
            <p className="text-body text-content-secondary">
              {[
                contact.title,
                contact.company?.name,
                contact.role ? ROLE_LABELS[contact.role as ContactRole] : null,
              ]
                .filter(Boolean)
                .join(" · ") || "No title yet"}
            </p>
            <p className="flex flex-wrap items-center gap-compact text-caption text-content-tertiary">
              {contact.email && <span>{contact.email}</span>}
              {contact.linkedin_url && (
                <a
                  href={
                    contact.linkedin_url.startsWith("http")
                      ? contact.linkedin_url
                      : `https://${contact.linkedin_url}`
                  }
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2 hover:text-content-primary"
                >
                  LinkedIn
                </a>
              )}
            </p>
            {contact.notes && (
              <p className="max-w-reading text-caption leading-relaxed text-content-secondary">
                {contact.notes}
              </p>
            )}
          </div>
        </div>
      </header>

      {contact.email ? (
        <ComposePanel
          contactId={contact.id}
          contactName={contact.full_name}
          contactEmail={contact.email}
          applications={options}
          previousMessages={messages.map((m) => ({
            id: m.id,
            subject: m.subject,
            created_at: m.created_at,
          }))}
          gmailConnected={gmail !== null}
          gmailAddress={gmail?.email ?? null}
        />
      ) : (
        <p className="rounded-default border border-dashed border-border-default px-default py-loose text-center text-body text-content-secondary">
          Add an email address for {contact.full_name} and you can draft outreach
          here.
        </p>
      )}

      <MessageHistory messages={messages} />
    </div>
  );
}
