"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SelectField, TextField } from "@/design-system/components/form-fields";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useT } from "@/i18n/client";
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
  const t = useT();
  const [state, action] = useActionState(createSeedlingAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <SelectField
        label={t("seedlings.create.numbering")}
        name="seriesId"
        defaultValue=""
        hint={t("seedlings.create.numberingHint")}
        options={[
          { value: "", label: t("seedlings.create.automaticOnly") },
          ...series.map((item) => ({
            value: item.id,
            label: item.usesYear
              ? t("seedlings.create.seriesWithYear", { name: item.name })
              : t("seedlings.create.seriesPlain", { name: item.name }),
          })),
        ]}
        error={errors.series}
      />

      <TextField
        label={t("seedlings.create.workingName")}
        name="workingName"
        maxLength={80}
        hint={t("seedlings.create.workingNameHint")}
        defaultValue={values?.workingName ?? ""}
        error={errors.workingName}
      />

      <TextField
        label={t("seedlings.create.firstGrownYear")}
        name="firstGrownYear"
        inputMode="numeric"
        maxLength={4}
        hint={t("seedlings.create.firstGrownYearHint")}
        defaultValue={values?.firstGrownYear ?? ""}
        error={errors.firstGrownYear}
      />

      <SelectField
        label={t("seedlings.create.visibility")}
        name="visibility"
        defaultValue="private"
        hint={t("seedlings.create.visibilityHint")}
        options={[
          { value: "private", label: t("glossary.visibleToOnlyMe") },
          { value: "public", label: t("glossary.visibleToVisitors") },
        ]}
        error={errors.visibility}
      />

      <SubmitButton pendingLabel={t("seedlings.create.submitting")}>
        {t("seedlings.create.submit")}
      </SubmitButton>
    </form>
  );
}
