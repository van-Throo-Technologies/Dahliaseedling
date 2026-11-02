"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/design-system/components/submit-button";
import { FormMessage } from "@/design-system/components/form-message";
import { TextField } from "@/design-system/components/form-fields";
import { useT } from "@/i18n/client";
import { createSeriesAction } from "@/modules/seedlings/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

/** A breeder's identifier prefix. Optional: growers without one still get automatic numbers. */
export function SeriesForm() {
  const t = useT();
  const [state, action] = useActionState(createSeriesAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      <TextField
        label={t("seedlings.series.name")}
        name="name"
        required
        maxLength={8}
        autoCapitalize="characters"
        hint={t("seedlings.series.nameHint")}
        defaultValue={values?.name ?? ""}
        error={errors.name}
      />

      <div className="flex min-h-11 items-center gap-3">
        <input
          id="field-includeYear"
          name="includeYear"
          type="checkbox"
          defaultChecked
          className="h-6 w-6 accent-[var(--color-text-brand)]"
        />
        <label htmlFor="field-includeYear" className="text-base text-text">
          {t("seedlings.series.includeYear")}
        </label>
      </div>

      <SubmitButton pendingLabel={t("seedlings.series.submitting")}>
        {t("seedlings.series.submit")}
      </SubmitButton>
    </form>
  );
}
