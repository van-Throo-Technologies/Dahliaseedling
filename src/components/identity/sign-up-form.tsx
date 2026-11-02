"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { TextField } from "@/design-system/components/form-fields";
import { useT } from "@/i18n/client";
import { signUpAction } from "@/modules/identity/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";

export function SignUpForm({ next }: { readonly next: string }) {
  const t = useT();
  const [state, action] = useActionState(signUpAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  if (state.status === "saved") {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage tone="success">{state.message}</FormMessage>
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="font-medium text-text-brand underline underline-offset-4"
        >
          {t("identity.signUp.goSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
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
      <TextField
        label={t("identity.fields.password")}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t("identity.signUp.passwordHint")}
        error={errors.password}
      />

      <SubmitButton pendingLabel={t("identity.signUp.submitting")}>
        {t("identity.signUp.submit")}
      </SubmitButton>

      <p className="text-base text-text-muted">
        {t("identity.signUp.haveAccount")}{" "}
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="font-medium text-text-brand underline underline-offset-4"
        >
          {t("identity.signUp.signIn")}
        </Link>
      </p>
    </form>
  );
}
