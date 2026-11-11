"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { TextField } from "@/design-system/components/form-fields";
import { useT } from "@/i18n/client";
import { requestPasswordResetAction } from "@/modules/identity/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { TurnstileWidget } from "@/components/identity/turnstile-widget";

/*
 * Asks for a reset email. The message is the same whether or not the address has an account, so the form reveals nothing about accounts.
 */
export function ForgotPasswordForm() {
  const t = useT();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const [state, action] = useActionState(requestPasswordResetAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" && state.message ? (
        <FormMessage tone="success">{state.message}</FormMessage>
      ) : null}

      <TextField
        label={t("identity.fields.email")}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={values?.email ?? ""}
        error={errors.email}
      />

      {siteKey ? (
        <TurnstileWidget
          siteKey={siteKey}
          action="password-reset"
          label={t("identity.captcha.label")}
          resetSignal={state}
        />
      ) : null}

      <SubmitButton pendingLabel={t("identity.recovery.forgotSubmitting")}>
        {t("identity.recovery.forgotSubmit")}
      </SubmitButton>
    </form>
  );
}
