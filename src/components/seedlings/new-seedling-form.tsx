"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SelectField, TextField } from "@/design-system/components/form-fields";
import { SubmitButton } from "@/design-system/components/submit-button";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { createSeedlingAction } from "@/modules/seedlings/actions";

export interface SeriesChoice {
  readonly id: string;
  readonly name: string;
  readonly usesYear: boolean;
}

/**
 * Creating a seedling needs no form beyond this. A seedling without a year is still created and gets its
 * automatic number. Only a year-based series needs the year, and the form says so before the user submits.
 */
export function NewSeedlingForm({ series }: { readonly series: readonly SeriesChoice[] }) {
  const [state, action] = useActionState(createSeedlingAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <SelectField
        label="Numbering"
        name="seriesId"
        defaultValue=""
        hint="Every seedling gets an automatic number, such as Seedling #1. A series adds your own identifier. Series with a year need the first grown year below."
        options={[
          { value: "", label: "Automatic number only" },
          ...series.map((item) => ({
            value: item.id,
            label: item.usesYear ? `Series ${item.name} (uses the year)` : `Series ${item.name}`,
          })),
        ]}
        error={errors.series}
      />

      <TextField
        label="Working name (optional)"
        name="workingName"
        maxLength={80}
        hint="A nickname you can change later. It does not replace the identifier."
        defaultValue={values?.workingName ?? ""}
        error={errors.workingName}
      />

      <TextField
        label="First grown year (optional)"
        name="firstGrownYear"
        inputMode="numeric"
        maxLength={4}
        hint="The year this seedling was first grown from seed. It is not the day you enter it."
        defaultValue={values?.firstGrownYear ?? ""}
        error={errors.firstGrownYear}
      />

      <SelectField
        label="Who can see it"
        name="visibility"
        defaultValue="private"
        hint="Private means only you can see this seedling. You can make it public later."
        options={[
          { value: "private", label: "Private (only me)" },
          { value: "public", label: "Public (visitors can see it)" },
        ]}
        error={errors.visibility}
      />

      <SubmitButton pendingLabel="Creating…">Create seedling</SubmitButton>
    </form>
  );
}
