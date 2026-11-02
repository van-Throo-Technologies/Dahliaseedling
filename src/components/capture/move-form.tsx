"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { moveObservationAction } from "@/modules/capture/actions";

export interface MoveChoice {
  readonly id: string;
  readonly label: string;
}

/**
 * Change: moves this observation to another seedling the grower holds, or to a new one. The photos are not
 * uploaded again and keep their identity.
 */
export function MoveForm({
  observationId,
  currentSeedlingId,
  seedlings,
}: {
  readonly observationId: string;
  readonly currentSeedlingId: string;
  readonly seedlings: readonly MoveChoice[];
}) {
  const [state, action] = useActionState(moveObservationAction, IDLE_FORM_STATE);
  const [mode, setMode] = useState<"new" | "existing" | "identifier">("new");
  const [seedlingId, setSeedlingId] = useState(
    seedlings.find((item) => item.id !== currentSeedlingId)?.id ?? "",
  );
  const options = seedlings.filter((item) => item.id !== currentSeedlingId);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="observationId" value={observationId} />
      <input type="hidden" name="mode" value={mode} />
      {mode === "existing" ? <input type="hidden" name="seedlingId" value={seedlingId} /> : null}
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-medium text-text">Move it to</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
          <input
            type="radio"
            name="destination"
            checked={mode === "new"}
            onChange={() => setMode("new")}
            className="h-5 w-5"
          />
          New seedling
        </label>
        {options.length > 0 ? (
          <label className="flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
            <input
              type="radio"
              name="destination"
              checked={mode === "existing"}
              onChange={() => setMode("existing")}
              className="mt-1 h-5 w-5"
            />
            <span className="flex flex-1 flex-col gap-2">
              One of my other seedlings
              {mode === "existing" ? (
                <select
                  aria-label="Choose a seedling"
                  value={seedlingId}
                  onChange={(event) => setSeedlingId(event.target.value)}
                  className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                >
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </span>
          </label>
        ) : null}
        <label className="flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
          <input
            type="radio"
            name="destination"
            checked={mode === "identifier"}
            onChange={() => setMode("identifier")}
            className="mt-1 h-5 w-5"
          />
          <span className="flex flex-1 flex-col gap-2">
            I know its identifier
            {mode === "identifier" ? (
              <input
                type="text"
                name="identifier"
                placeholder="JV-26-001 or #12"
                autoComplete="off"
                aria-label="Seedling identifier"
                className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
              />
            ) : null}
          </span>
        </label>
        {errors.identifier ? (
          <p className="text-sm font-medium text-destructive">{errors.identifier}</p>
        ) : null}
      </fieldset>

      <SubmitButton pendingLabel="Moving…">Move observation</SubmitButton>
      <p className="text-sm text-text-muted">
        The photos are not uploaded again. Only the seedling it belongs to changes.
      </p>
    </form>
  );
}
