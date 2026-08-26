import type { ApplicationRow } from "@/lib/data/applications";
import {
  ALL_STATUSES,
  STATUS_LABELS,
  needsAction,
  stageLine,
  statusTone,
  type Status,
} from "@/lib/applications/pipeline";
import { StatusBadge } from "./status-badge";
import { setStatusAction, setNextActionAction } from "@/app/actions";

/**
 * ApplicationCard — a card on the pipeline board. Figma node 4:293.
 *
 * 8px radius, 14/13 padding, a 26px company tile, the role, and a grey meta
 * line preceded by a status dot. The badge appears only when the card is asking
 * for something.
 *
 * The frame has no controls on the card, but the board has to be operable, so
 * there is one addition: a collapsed "Update" disclosure holding the status
 * moves and the next-action form. It is a native <details>, which keeps the
 * board keyboard-operable and working without JavaScript, and it stays out of
 * the way until opened so the resting state still matches the frame. This is a
 * deviation from the mockup and wants a design decision — DESIGN.md §5 has no
 * entry for it.
 *
 * Status changes list all eight real statuses rather than the four columns.
 * Dragging a card into "In process" could not say whether you meant a recruiter
 * screen, a technical, or an onsite; picking the status says exactly.
 */

export function ApplicationCard({ app }: { app: ApplicationRow }) {
  const attention = needsAction(app);
  const initial = app.company_name.trim().charAt(0).toUpperCase();

  return (
    <article className="flex flex-col gap-compact rounded-card border border-border-subtle bg-surface-base px-card-x py-card-y">
      <div className="flex items-center gap-chip">
        <span
          aria-hidden="true"
          className="flex size-avatar shrink-0 items-center justify-center overflow-hidden rounded-subtle bg-surface-sunken text-caption font-semibold leading-none text-content-primary"
        >
          {app.company_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.company_logo_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-contain p-hair"
            />
          ) : (
            initial
          )}
        </span>
        <p className="truncate text-caption font-medium leading-none text-content-secondary">
          {app.company_name}
        </p>
      </div>

      <h3 className="text-body font-semibold leading-default tracking-snug text-content-primary">
        {app.job_url ? (
          <a href={app.job_url} target="_blank" rel="noreferrer noopener">
            {app.job_title}
          </a>
        ) : (
          app.job_title
        )}
      </h3>

      <p className="flex items-center gap-tight text-caption leading-none text-content-tertiary">
        <span
          aria-hidden="true"
          className={`size-[0.3125rem] shrink-0 rounded-full ${statusTone(app.status)}`}
        />
        <span className="truncate">{stageLine(app)}</span>
      </p>

      {/*
        A closed posting is worth saying out loud: it changes what the next
        action should be, and DESIGN.md §7 lists it as a state that must be
        designed rather than left silent.
      */}
      {app.job_closed_at && (
        <p className="text-caption text-content-tertiary">Posting has since closed</p>
      )}

      {attention.needed && attention.reason && <StatusBadge label={attention.reason} />}

      <details className="group">
        <summary className="cursor-pointer list-none text-caption text-content-tertiary underline underline-offset-2">
          Update
        </summary>

        <div className="flex flex-col gap-compact pt-compact">
          <form action={setStatusAction} className="flex flex-col gap-tight">
            <input type="hidden" name="applicationId" value={app.id} />
            <fieldset className="flex flex-wrap gap-tight">
              <legend className="pb-tight text-caption text-content-tertiary">
                Move to
              </legend>
              {ALL_STATUSES.filter((s) => s !== app.status).map((status) => (
                <button
                  key={status}
                  type="submit"
                  name="status"
                  value={status}
                  className="rounded-tag border border-border-subtle bg-surface-base px-tight py-hair text-caption text-content-secondary"
                >
                  {STATUS_LABELS[status as Status]}
                </button>
              ))}
            </fieldset>
          </form>

          <form action={setNextActionAction} className="flex flex-col gap-tight">
            <input type="hidden" name="applicationId" value={app.id} />
            <label
              htmlFor={`next-${app.id}`}
              className="text-caption text-content-tertiary"
            >
              Next action
            </label>
            <input
              id={`next-${app.id}`}
              name="nextAction"
              defaultValue={app.next_action ?? ""}
              placeholder="Follow up with recruiter"
              className="rounded-tag border border-border-subtle bg-surface-base px-tight py-hair text-caption text-content-primary placeholder:text-content-tertiary"
            />
            <div className="flex items-center gap-tight">
              <label htmlFor={`when-${app.id}`} className="sr-only">
                Next action date
              </label>
              <input
                id={`when-${app.id}`}
                type="date"
                name="nextActionAt"
                defaultValue={app.next_action_at ?? ""}
                className="min-w-0 flex-1 rounded-tag border border-border-subtle bg-surface-base px-tight py-hair text-caption text-content-primary"
              />
              <button
                type="submit"
                className="shrink-0 rounded-tag bg-accent-default px-tight py-hair text-caption font-medium text-content-inverse"
              >
                Set
              </button>
            </div>
          </form>
        </div>
      </details>
    </article>
  );
}
