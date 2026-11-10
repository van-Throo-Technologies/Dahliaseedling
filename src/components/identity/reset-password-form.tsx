"use client";

import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { TextField } from "@/design-system/components/form-fields";
import { useT } from "@/i18n/client";
import { setRecoveredPasswordAction } from "@/modules/identity/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

/** Sets a new password from a reset link. It is a separate form from the invitation password form, with its own action. */
export function ResetPasswordForm() {
  const t = useT();
  const [state, action] = useActionState(setRecoveredPasswordAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}

      <TextField
        label={t("identity.fields.password")}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t("identity.signUp.passwordHint")}
        error={errors.password}
      />

      <SubmitButton pendingLabel={t("identity.recovery.resetSubmitting")}>
        {t("identity.recovery.resetSubmit")}
      </SubmitButton>
    </form>
  );
}
