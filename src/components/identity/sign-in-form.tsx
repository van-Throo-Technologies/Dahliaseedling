"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { TextField } from "@/design-system/components/form-fields";
import { useT } from "@/i18n/client";
import { signInAction } from "@/modules/identity/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { TurnstileWidget } from "@/components/identity/turnstile-widget";

export function SignInForm({ next }: { readonly next: string }) {
  const t = useT();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const [state, action] = useActionState(signInAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

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
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <p className="-mt-3 text-base">
        <Link
          href="/forgot-password"
          className="font-medium text-text-brand underline underline-offset-4"
        >
          {t("identity.recovery.forgotLink")}
        </Link>
      </p>

      {siteKey ? (
        <TurnstileWidget
          siteKey={siteKey}
          action="sign-in"
          label={t("identity.captcha.label")}
          resetSignal={state}
        />
      ) : null}

      <SubmitButton pendingLabel={t("identity.signIn.submitting")}>
        {t("identity.signIn.submit")}
      </SubmitButton>

      <p className="text-base text-text-muted">
        {t("identity.signIn.newHere")}{" "}
        <Link
          href={`/sign-up?next=${encodeURIComponent(next)}`}
          className="font-medium text-text-brand underline underline-offset-4"
        >
          {t("identity.signIn.createAccount")}
        </Link>
      </p>
    </form>
  );
}
