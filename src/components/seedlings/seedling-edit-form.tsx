"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SelectField, TextField } from "@/design-system/components/form-fields";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { updateSeedlingAction } from "@/modules/seedlings/actions";

export interface SeedlingCoreDefaults {
  readonly workingName: string;
  readonly firstGrownYear: string;
  readonly visibility: "private" | "public";
}

/** Only the fields the specification lets a holder change. Identity and originator are not here. */
export function SeedlingEditForm({
  seedlingId,
  defaults,
}: {
  readonly seedlingId: string;
  readonly defaults: SeedlingCoreDefaults;
}) {
  const [state, action] = useActionState(updateSeedlingAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="seedlingId" value={seedlingId} />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      <TextField
        label="Working name"
        name="workingName"
        maxLength={80}
        defaultValue={defaults.workingName}
        error={errors.workingName}
      />
      <TextField
        label="First grown year"
        name="firstGrownYear"
        inputMode="numeric"
        maxLength={4}
        hint="Needed to number this seedling with a year-based series. Changing it does not rename identifiers that already exist."
        defaultValue={defaults.firstGrownYear}
        error={errors.firstGrownYear}
      />
      <SelectField
        label="Who can see it"
        name="visibility"
        defaultValue={defaults.visibility}
        hint="Making it public lets visitors see this seedling, its identifiers and its history."
        options={[
          { value: "private", label: "Private (only me)" },
          { value: "public", label: "Public (visitors can see it)" },
        ]}
        error={errors.visibility}
      />

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
