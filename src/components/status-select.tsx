"use client";

import { useRef } from "react";
import { Select } from "./select";
import { setStatusAction } from "@/app/actions";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/applications/pipeline";

/**
 * Changing an application's status from the list.
 *
 * Committing a choice submits immediately. A separate save button would be one
 * more click on the single most-repeated action in the tracker, and there is
 * nothing to review — the choice *is* the change, and the timeline records it
 * either way, so an accident is visible and reversible.
 *
 * All eight statuses, not the four board columns. The board groups the three
 * interview stages under "In process" because at a glance that is the fact you
 * want; setting a status is the other moment, where saying which one is the
 * whole point.
 */
export function StatusSelect({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setStatusAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <Select
        name="status"
        defaultValue={status}
        ariaLabel="Application status"
        options={ALL_STATUSES.map((s) => ({
          value: s,
          label: STATUS_LABELS[s],
        }))}
        onCommit={(next) => {
          if (next !== status) formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
