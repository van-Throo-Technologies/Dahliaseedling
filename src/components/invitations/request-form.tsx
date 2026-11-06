"use client";

import { useActionState, useState } from "react";
import { CountrySelect, TextAreaField, TextField } from "@/design-system/components/form-fields";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useT } from "@/i18n/client";
import { submitInvitationRequestAction } from "@/modules/invitations/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

/*
 * The request form. The client key is created once per form, so a retry after an error is the same request, not a second one. The
 * honeypot is hidden from people and submits an empty value; a filled value marks the request as automated.
 */
export function InvitationRequestForm() {
  const t = useT();
  const [clientKey] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState(submitInvitationRequestAction, IDLE_FORM_STATE);

  if (state.status === "saved") {
    return (
      <FormMessage tone="success">{state.message ?? t("invitations.join.received")}</FormMessage>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="clientKey" value={clientKey} />
      <div hidden aria-hidden="true">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <TextField
        label={t("invitations.join.name")}
        name="name"
        autoComplete="name"
        required
        hint={t("invitations.join.nameHint")}
        defaultValue={values?.name ?? ""}
        error={errors.name}
      />
      <CountrySelect
        label={t("invitations.join.country")}
        name="countryCode"
        required
        hint={t("invitations.join.countryHint")}
        defaultValue={values?.countryCode ?? ""}
        error={errors.countryCode}
      />
      <TextField
        label={t("invitations.join.email")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={values?.email ?? ""}
        error={errors.email}
      />
      <TextAreaField
        label={t("invitations.join.reason")}
        name="reason"
        required
        rows={5}
        hint={t("invitations.join.reasonHint")}
        defaultValue={values?.reason ?? ""}
        error={errors.reason}
      />

      <SubmitButton pendingLabel={t("invitations.join.submitting")}>
        {t("invitations.join.submit")}
      </SubmitButton>
    </form>
  );
}
