"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SelectField, TextField } from "@/design-system/components/form-fields";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useT } from "@/i18n/client";
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
  const t = useT();
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
        label={t("seedlings.edit.workingName")}
        name="workingName"
        maxLength={80}
        defaultValue={defaults.workingName}
        error={errors.workingName}
      />
      <TextField
        label={t("seedlings.edit.firstGrownYear")}
        name="firstGrownYear"
        inputMode="numeric"
        maxLength={4}
        hint={t("seedlings.edit.firstGrownYearHint")}
        defaultValue={defaults.firstGrownYear}
        error={errors.firstGrownYear}
      />
      <SelectField
        label={t("seedlings.edit.visibility")}
        name="visibility"
        defaultValue={defaults.visibility}
        hint={t("seedlings.edit.visibilityHint")}
        options={[
          { value: "private", label: t("glossary.visibleToOnlyMe") },
          { value: "public", label: t("glossary.visibleToVisitors") },
        ]}
        error={errors.visibility}
      />

      <SubmitButton pendingLabel={t("seedlings.edit.submitting")}>
        {t("seedlings.edit.submit")}
      </SubmitButton>
    </form>
  );
}
