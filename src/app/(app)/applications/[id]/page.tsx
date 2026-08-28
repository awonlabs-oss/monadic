import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getApplication,
  applicationTimeline,
} from "@/lib/data/applications";
import { contactsForApplication } from "@/lib/data/contacts";
import { listMessagesForApplication } from "@/lib/data/outreach";
import { connectedAccount } from "@/outreach/gmail";
import { STATUS_LABELS, needsAction, type Status } from "@/lib/applications/pipeline";
import { relativeShort } from "@/lib/format";
import { CompanyLogo } from "@/components/company-logo";
import { StatusPicker } from "@/components/status-picker";
import { ViewPosting } from "@/components/view-posting";
import { NextActionForm } from "@/components/next-action-form";
import { OutreachHub } from "@/components/outreach-hub";
import { AddContact } from "@/components/add-contact";
import { MessageHistory } from "@/components/message-history";

/*
 * /applications/[id] — one application, and everything you do about it.
 *
 * This is the surface an applied job goes to once applying is done. Up to here
 * the app is a triage tool: the feed answers "is this worth a press", the job
 * page answers "what is this role". Neither answers the question that fills the
 * weeks afterwards, which is "who do I talk to, what did I already say, and
 * what am I doing next" — and answering it previously meant three places. The
 * contact list did not know which application anyone belonged to, the composer
 * lived on a contact's own page and had to be told the application by name, and
 * the next action was a column in a table.
 *
 * So they are one page, in the order the work happens: what is next, who to
 * write to, the panel that writes it, what has been said, what happened.
 *
 * The posting itself is deliberately not repeated here. It is one link away and
 * unchanged, and a copy of the description under the outreach panel would make
 * this a longer version of the job page rather than a different surface.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const app = await getApplication((await params).id);
  if (!app) return { title: "Application not found — Monadic" };
  return { title: `${app.job_title} at ${app.company_name} — Monadic` };
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-snug">
      <div className="flex flex-wrap items-baseline justify-between gap-compact">
        <div className="flex flex-col gap-hair">
          <h2 className="text-small font-medium text-content-primary">
            {title}
          </h2>
          {description && (
            <p className="text-caption text-content-tertiary">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await getApplication(id);
  if (!app) notFound();

  const [contacts, messages, timeline, gmail] = await Promise.all([
    contactsForApplication(id, app.company_id ?? null),
    listMessagesForApplication(id),
    applicationTimeline(id),
    connectedAccount(),
  ]);

  const attention = needsAction(app);
  const label = `${app.job_title} · ${app.company_name}`;
  const linked = contacts.filter((c) => c.linked).length;

  return (
    <div className="flex flex-col gap-loose px-page pt-section pb-page">
      <header className="flex flex-col gap-snug">
        <Link
          href="/applications"
          className="w-fit text-caption text-content-tertiary underline underline-offset-2 transition-colors hover:text-content-primary"
        >
          All tracked
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-body">
          <div className="flex min-w-0 items-start gap-body">
            <CompanyLogo
              name={app.company_name}
              src={app.company_logo_url}
              size="card"
            />
            <div className="flex min-w-0 flex-col gap-tight">
              {/*
                The role, not the serif. Section 1 keeps the display face for
                page titles — "Tracked", "For You" — and off data, and a job
                title is data.
              */}
              <h1 className="text-title font-semibold leading-tight tracking-tight text-content-primary">
                {app.job_title}
              </h1>
              <p className="flex flex-wrap items-center gap-compact text-body text-content-secondary">
                <span>{app.company_name}</span>
                <span className="text-caption text-content-tertiary">
                  {STATUS_LABELS[app.status as Status] ?? app.status}
                  {" · "}
                  {relativeShort(app.status_changed_at)}
                </span>
              </p>
              {app.job_closed_at && (
                <p className="text-caption text-badge-amber-fg">
                  The posting has closed. Your application is unaffected — this
                  is about the listing, not about you.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-compact">
            <StatusPicker applicationId={app.id} status={app.status} />
            {app.job_url && (
              <ViewPosting
                url={app.job_url}
                jobTitle={app.job_title}
                companyName={app.company_name}
                size="page"
              />
            )}
            <Link
              href={`/jobs/${app.job_id}`}
              className="rounded-subtle border border-border-subtle bg-surface-base px-body py-compact text-small font-medium leading-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content-primary"
            >
              Job details
            </Link>
          </div>
        </div>

        {attention.needed && (
          <p className="rounded-default bg-badge-amber-bg px-default py-compact text-body text-badge-amber-fg">
            {attention.reason}
          </p>
        )}
      </header>

      <Panel
        title="Next action"
        description="One thing, with a date. The board reads the date to tell you when it has slipped."
      >
        <NextActionForm
          applicationId={app.id}
          nextAction={app.next_action}
          nextActionAt={app.next_action_at}
          overdue={Boolean(app.next_action_overdue)}
        />
      </Panel>

      <Panel
        title="People"
        description={
          linked === 0
            ? "Nobody attached to this role yet."
            : `${linked} in this process`
        }
        action={
          app.company_id ? (
            <AddContact
              companies={[{ id: app.company_id, name: app.company_name }]}
              defaultCompanyId={app.company_id}
              label="Add someone"
            />
          ) : null
        }
      >
        {contacts.length === 0 ? (
          <p className="rounded-default border border-dashed border-border-default px-default py-loose text-center text-body text-content-secondary">
            No contacts at {app.company_name} yet. Add the recruiter or the
            hiring manager and you can draft to them from here.
          </p>
        ) : (
          <OutreachHub
            applicationId={app.id}
            applicationLabel={label}
            contacts={contacts.map((c) => ({
              id: c.id,
              full_name: c.full_name,
              title: c.title,
              email: c.email,
              role: c.role,
              role_in_process: c.role_in_process,
              linked: c.linked,
              messages_here: c.messages_here,
            }))}
            previousMessages={messages.map((m) => ({
              id: m.id,
              contact_id: m.contact_id,
              subject: m.subject,
              created_at: m.created_at,
            }))}
            gmailConnected={gmail !== null}
            gmailAddress={gmail?.email ?? null}
          />
        )}
      </Panel>

      {/*
        Everything written about this role, whoever it went to. The contact page
        shows one person's thread; three emails to three people here are one
        conversation from where you are standing.
      */}
      <MessageHistory messages={messages} />

      <section className="flex flex-col gap-compact border-t border-border-subtle pt-default">
        <h2 className="text-small font-medium text-content-primary">
          Timeline
          <span className="pl-tight tabular-nums text-content-tertiary">
            {timeline.length}
          </span>
        </h2>
        {timeline.length === 0 ? (
          <p className="text-caption text-content-tertiary">
            Nothing recorded yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-compact">
            {timeline.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline gap-compact text-body"
              >
                <span className="w-24 shrink-0 text-caption tabular-nums text-content-tertiary">
                  {relativeShort(event.occurred_at)}
                </span>
                <span className="text-content-secondary">
                  {event.title ??
                    (event.to_status
                      ? `Moved to ${
                          STATUS_LABELS[event.to_status as Status] ??
                          event.to_status
                        }`
                      : event.event_type)}
                </span>
                {event.body && (
                  <span className="text-caption text-content-tertiary">
                    {event.body}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
