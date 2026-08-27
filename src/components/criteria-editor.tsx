import { REMOTE_PREFERENCES, type CriteriaInput } from "@/lib/data/criteria";
import { saveCriteriaAction } from "@/app/actions";
import { Select } from "./select";

/**
 * The form behind /for-you.
 *
 * A plain GET-shaped server-action form, no client component: every field is a
 * value you type and submit, and there is nothing to react to in between.
 *
 * When nothing is saved yet the fields arrive pre-filled from the resume and
 * the form says so. That is the whole point of drafting — the parse proposes,
 * you correct, and nothing reaches the feed until you press save. An unsaved
 * draft is visible but inert.
 */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-tight">
      <span className="text-small font-medium text-content-primary">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-caption leading-relaxed text-content-tertiary">
          {hint}
        </span>
      )}
    </label>
  );
}

const INPUT =
  "rounded-subtle border border-border-subtle bg-surface-base px-compact py-tight text-body text-content-primary placeholder:text-content-tertiary";

export function CriteriaEditor({
  criteria,
  isDraft,
  hasResume,
}: {
  criteria: CriteriaInput;
  isDraft: boolean;
  hasResume: boolean;
}) {
  return (
    <form action={saveCriteriaAction} className="flex flex-col gap-body">
      {isDraft && (
        <p className="rounded-card bg-badge-amber-bg px-cozy py-compact text-caption leading-relaxed text-badge-amber-fg">
          {hasResume
            ? "Drafted from your resume and not saved yet. It infers what you want next from what you have done, which is a guess the resume does not actually make — correct it, then save."
            : "Nothing saved and no resume parsed, so there is nothing to draft from. Fill these in, or upload a resume first."}
        </p>
      )}

      <Field
        label="Target roles"
        hint="Comma separated. A job matches when its title carries two thirds of a role's words, so 'forward deployed engineer' finds 'Deployed Engineer (Federal)' but 'solutions engineer' does not find 'Security Engineer'."
      >
        <input
          name="roles"
          defaultValue={criteria.targetRoleTypes.join(", ")}
          placeholder="forward deployed engineer, solutions engineer"
          className={INPUT}
        />
      </Field>

      <div className="grid grid-cols-1 gap-body sm:grid-cols-2">
        <Field
          label="Years of experience"
          hint="The band a posting has to overlap, not your own total."
        >
          <div className="flex items-center gap-tight">
            <input
              name="yearsMin"
              inputMode="numeric"
              defaultValue={criteria.yearsMin ?? ""}
              placeholder="0"
              className={`${INPUT} w-16`}
              aria-label="Minimum years"
            />
            <span className="text-body text-content-tertiary">to</span>
            <input
              name="yearsMax"
              inputMode="numeric"
              defaultValue={criteria.yearsMax ?? ""}
              placeholder="5"
              className={`${INPUT} w-16`}
              aria-label="Maximum years"
            />
          </div>
        </Field>

        <Field
          label="Pay floor"
          hint="Thousands. A posting that states no pay is not counted against — it simply has nothing to check."
        >
          <input
            name="compFloor"
            inputMode="numeric"
            defaultValue={
              criteria.compFloor ? Math.round(criteria.compFloor / 1000) : ""
            }
            placeholder="130"
            className={`${INPUT} w-24`}
          />
        </Field>

        <Field
          label="Cities"
          hint="Comma separated, matched against the posting's parsed city."
        >
          <input
            name="locations"
            defaultValue={criteria.locations.join(", ")}
            placeholder="New York, San Francisco"
            className={INPUT}
          />
        </Field>

        <Field label="Workplace">
          <Select
            name="remote"
            defaultValue={criteria.remotePreference ?? ""}
            placeholder="Not stated"
            ariaLabel="Workplace preference"
            options={[
              {
                value: "",
                label: "Not stated",
                hint: "The criterion is not applied",
              },
              ...REMOTE_PREFERENCES.map((p) => ({
                value: p.key,
                label: p.label,
              })),
            ]}
          />
        </Field>
      </div>

      <Field
        label="How far back to look"
        hint="Days. The median open posting here is 51 days old, and the oldest is nearly six years — a window is what keeps the feed to roles that are plausibly still live."
      >
        <input
          name="recencyDays"
          inputMode="numeric"
          defaultValue={criteria.recencyDays}
          className={`${INPUT} w-24`}
        />
      </Field>

      {/*
        Company stage appears in the Figma criteria chips and is not here,
        because it cannot be checked against anything. Saying so is better than
        offering a field that silently does nothing.
      */}
      <p className="text-caption leading-relaxed text-content-tertiary">
        Company stage and headcount are not offered. No ATS returns them and
        there is no column holding them, so a stage criterion could not be
        checked against any posting.
      </p>

      <div className="flex items-center gap-compact">
        <button
          type="submit"
          className="rounded-subtle bg-accent-default px-default py-compact text-small font-medium leading-none text-content-inverse transition-colors hover:bg-accent-hover"
        >
          {isDraft ? "Save criteria" : "Update criteria"}
        </button>
      </div>
    </form>
  );
}
