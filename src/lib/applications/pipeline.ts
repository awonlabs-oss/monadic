/**
 * The pipeline model: how eight database statuses become four board columns,
 * and what makes a card need attention.
 *
 * Both live here rather than in the view or the components, because both are
 * judgement calls that will be retuned. The database stores the raw facts —
 * status, days_in_stage, next_action_at — and this file decides what they mean.
 */

export type Status =
  | "shortlisted"
  | "applied"
  | "recruiter_screen"
  | "technical"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn";

export const STATUS_LABELS: Record<Status, string> = {
  shortlisted: "Saved",
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  technical: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export interface Column {
  key: string;
  label: string;
  statuses: Status[];
  /** Days in stage after which a card in this column wants attention. */
  staleAfterDays: number | null;
  /** Shown when the column has nothing in it. */
  emptyCopy: string;
}

/**
 * Four columns, per the Figma frame. "In process" absorbs the three interview
 * stages: the board answers "where does this stand", and the distinction
 * between a recruiter screen and an onsite is a detail of that answer, carried
 * on the card itself rather than by a column each.
 *
 * Thresholds differ by column on purpose. Six days sitting in Saved without
 * applying is a nudge; six days inside an interview loop is just how long
 * interview loops take. One global threshold would either nag about the second
 * or stay silent about the first.
 */
export const COLUMNS: Column[] = [
  {
    key: "saved",
    label: "Saved",
    statuses: ["shortlisted"],
    staleAfterDays: 5,
    emptyCopy: "Nothing saved yet. Press Save on a job to start one here.",
  },
  {
    key: "applied",
    label: "Applied",
    statuses: ["applied"],
    staleAfterDays: 10,
    emptyCopy: "Nothing applied to yet.",
  },
  {
    key: "inprocess",
    label: "In process",
    statuses: ["recruiter_screen", "technical", "onsite"],
    staleAfterDays: 7,
    emptyCopy: "No live interview processes.",
  },
  {
    key: "offer",
    label: "Offer",
    statuses: ["offer"],
    staleAfterDays: null,
    emptyCopy: "Nothing here yet. Move a card across when an offer lands.",
  },
];

/** Kept off the board by default. Never deleted — the timeline keeps every one. */
export const CLOSED_STATUSES: Status[] = ["rejected", "withdrawn"];

export const ALL_STATUSES: Status[] = [
  ...COLUMNS.flatMap((c) => c.statuses),
  ...CLOSED_STATUSES,
];

export function columnFor(status: string): Column | null {
  return COLUMNS.find((c) => (c.statuses as string[]).includes(status)) ?? null;
}

export function isClosed(status: string): boolean {
  return (CLOSED_STATUSES as string[]).includes(status);
}

/** Which colour token the status dot uses. Never the only signal — the meta line says the same thing in words. */
export function statusTone(status: string): string {
  if (status === "shortlisted") return "bg-status-saved";
  if (status === "applied") return "bg-status-applied";
  if (isClosed(status)) return "bg-status-saved";
  return "bg-status-inprocess";
}

export interface NeedsAction {
  needed: boolean;
  reason: string | null;
}

/**
 * Whether a card is asking for something.
 *
 * An overdue next action always counts — you told yourself to do a thing by a
 * date and the date passed. Otherwise it is time in stage against the column's
 * own threshold. Closed applications and offers are never nagged.
 */
export function needsAction(app: {
  status: string;
  days_in_stage: number | null;
  next_action: string | null;
  next_action_overdue: boolean | null;
}): NeedsAction {
  if (isClosed(app.status)) return { needed: false, reason: null };

  if (app.next_action_overdue) {
    return { needed: true, reason: app.next_action ?? "Next action overdue" };
  }

  const column = columnFor(app.status);
  if (!column?.staleAfterDays) return { needed: false, reason: null };

  const days = app.days_in_stage ?? 0;
  if (days < column.staleAfterDays) return { needed: false, reason: null };

  if (app.status === "shortlisted") return { needed: true, reason: "Not applied yet" };
  if (app.status === "applied") return { needed: true, reason: "No reply — follow up" };
  return { needed: true, reason: "No movement — follow up" };
}

/** The card's grey meta line: what happened, and when. */
export function stageLine(app: {
  status: string;
  days_in_stage: number | null;
  applied_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
}): string {
  // A scheduled next action is the most useful thing the line can say, so it
  // wins over stage history when one is set.
  if (app.next_action && app.next_action_at) {
    const when = new Date(app.next_action_at).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    return `${app.next_action} · ${when}`;
  }

  const days = app.days_in_stage ?? 0;
  const ago = days === 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
  const verb = STATUS_LABELS[app.status as Status] ?? app.status;

  if (app.status === "shortlisted" && days >= 5) return `Saved ${ago}, not applied`;
  return `${verb} ${ago}`;
}
