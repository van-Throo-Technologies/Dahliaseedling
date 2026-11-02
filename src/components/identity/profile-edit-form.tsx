"use client";

import { useActionState } from "react";
import {
  CountrySelect,
  FileField,
  TextAreaField,
  TextField,
} from "@/design-system/components/form-fields";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useT } from "@/i18n/client";
import { updateProfileAction } from "@/modules/identity/actions";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { LIMITS } from "@/modules/identity/validation";

export interface ProfileEditDefaults {
  readonly displayName: string;
  readonly countryCode: string;
  readonly regionCity: string;
  readonly bio: string;
  readonly accountTypeLabel: string;
}

export function ProfileEditForm({ defaults }: { readonly defaults: ProfileEditDefaults }) {
  const t = useT();
  const [state, action] = useActionState(updateProfileAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;
  const pick = (name: keyof ProfileEditDefaults) => values?.[name] ?? defaults[name];

  return (
    <form action={action} noValidate encType="multipart/form-data" className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      <TextField
        label={t("identity.fields.displayName")}
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={LIMITS.displayNameMax}
        defaultValue={pick("displayName")}
        error={errors.displayName}
      />
      <CountrySelect
        label={t("identity.fields.country")}
        name="countryCode"
        required
        defaultValue={pick("countryCode")}
        error={errors.countryCode}
      />
      <TextField
        label={t("identity.fields.regionCity")}
        name="regionCity"
        autoComplete="address-level2"
        maxLength={LIMITS.regionCityMax}
        defaultValue={pick("regionCity")}
        error={errors.regionCity}
      />
      <TextAreaField
        label={t("identity.fields.bio")}
        name="bio"
        maxLength={LIMITS.bioMax}
        hint={t("identity.fields.bioHint", { max: LIMITS.bioMax })}
        defaultValue={pick("bio")}
        error={errors.bio}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="field-accountTypeLabel" className="text-base font-medium text-text">
          {t("identity.fields.accountType")}
        </label>
        <select
          id="field-accountTypeLabel"
          name="accountTypeLabel"
          defaultValue={pick("accountTypeLabel")}
          aria-invalid={errors.accountTypeLabel ? true : undefined}
          aria-describedby="field-accountTypeLabel-hint"
          className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-text"
        >
          <option value="">{t("identity.fields.accountTypeNotSpecified")}</option>
          <option value="individual">{t("identity.fields.accountTypeIndividual")}</option>
          <option value="breeder">{t("identity.fields.accountTypeBreeder")}</option>
          <option value="farm">{t("identity.fields.accountTypeFarm")}</option>
        </select>
        <p id="field-accountTypeLabel-hint" className="text-sm text-text-muted">
          {t("identity.fields.accountTypeHint")}
        </p>
        {errors.accountTypeLabel ? (
          <p className="text-sm font-medium text-destructive">{errors.accountTypeLabel}</p>
        ) : null}
      </div>
      <FileField
        label={t("identity.fields.avatar")}
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        hint={t("identity.fields.avatarHint")}
        error={errors.avatar}
      />

      <SubmitButton pendingLabel={t("common.saving")}>{t("identity.edit.submit")}</SubmitButton>
    </form>
  );
}
