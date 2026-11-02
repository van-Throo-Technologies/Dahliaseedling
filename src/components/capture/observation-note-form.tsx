"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { updateObservationAction } from "@/modules/capture/actions";
import { CAPTURE_LIMITS } from "@/modules/capture/limits";

/** Edits the note and, if needed, the observed time. The original dictation transcript is never changed here. */
export function ObservationNoteForm({
  observationId,
  defaultNote,
}: {
  readonly observationId: string;
  readonly defaultNote: string;
}) {
  const [state, action] = useActionState(updateObservationAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="observationId" value={observationId} />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      <label htmlFor="observation-note" className="text-base font-medium text-text">
        Note
      </label>
      <textarea
        id="observation-note"
        name="note"
        rows={4}
        maxLength={CAPTURE_LIMITS.noteMaxLength}
        defaultValue={defaultNote}
        aria-invalid={errors.note ? true : undefined}
        aria-describedby={errors.note ? "observation-note-error" : undefined}
        className="w-full rounded-control border border-border bg-background px-3 py-2 text-base text-text"
      />
      {errors.note ? (
        <p id="observation-note-error" className="text-sm font-medium text-destructive">
          {errors.note}
        </p>
      ) : null}

      <label htmlFor="observation-time" className="text-base font-medium text-text">
        Observed at (optional)
      </label>
      <input
        id="observation-time"
        name="observedAt"
        type="datetime-local"
        className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
        aria-describedby="observation-time-hint"
      />
      <p id="observation-time-hint" className="text-sm text-text-muted">
        Leave it empty to keep the time it has now.
      </p>
      {errors.observedAt ? (
        <p className="text-sm font-medium text-destructive">{errors.observedAt}</p>
      ) : null}

      <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
    </form>
  );
}
