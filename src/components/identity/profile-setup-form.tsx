"use client";

import { useActionState } from "react";
import { CountrySelect, TextField } from "@/design-system/components/form-fields";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { createProfileAction } from "@/modules/identity/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

/** The minimum needed to take part: a display name and a country. Everything else is optional. */
export function ProfileSetupForm({ next }: { readonly next: string }) {
  const [state, action] = useActionState(createProfileAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <TextField
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        required
        hint="This is how other growers see you. It can be a person's name or a breeder or farm name."
        defaultValue={values?.displayName ?? ""}
        error={errors.displayName}
      />
      <CountrySelect
        label="Country"
        name="countryCode"
        required
        hint="Shown on your public profile."
        defaultValue={values?.countryCode ?? ""}
        error={errors.countryCode}
      />

      <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
    </form>
  );
}
