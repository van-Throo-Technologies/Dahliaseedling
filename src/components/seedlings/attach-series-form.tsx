"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SelectField } from "@/design-system/components/form-fields";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useT } from "@/i18n/client";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { attachSeriesAction } from "@/modules/seedlings/actions";

export interface AttachableSeries {
  readonly id: string;
  readonly label: string;
}

/**
 * Adds a Series identifier to a seedling that was created without one. The seedling keeps its number and
 * its identity. A year-based series needs the first-grown year first, and the message says so.
 */
export function AttachSeriesForm({
  seedlingId,
  series,
}: {
  readonly seedlingId: string;
  readonly series: readonly AttachableSeries[];
}) {
  const t = useT();
  const [state, action] = useActionState(attachSeriesAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="seedlingId" value={seedlingId} />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}
      <SelectField
        label={t("seedlings.attach.label")}
        name="seriesId"
        defaultValue=""
        error={errors.seriesId}
        options={[
          { value: "", label: t("seedlings.attach.choose") },
          ...series.map((item) => ({ value: item.id, label: item.label })),
        ]}
      />
      <SubmitButton pendingLabel={t("seedlings.attach.submitting")}>
        {t("seedlings.attach.submit")}
      </SubmitButton>
    </form>
  );
}
