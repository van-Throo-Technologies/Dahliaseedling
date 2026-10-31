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
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={LIMITS.displayNameMax}
        defaultValue={pick("displayName")}
        error={errors.displayName}
      />
      <CountrySelect
        label="Country"
        name="countryCode"
        required
        defaultValue={pick("countryCode")}
        error={errors.countryCode}
      />
      <TextField
        label="Region or city (optional)"
        name="regionCity"
        autoComplete="address-level2"
        maxLength={LIMITS.regionCityMax}
        defaultValue={pick("regionCity")}
        error={errors.regionCity}
      />
      <TextAreaField
        label="Bio (optional)"
        name="bio"
        maxLength={LIMITS.bioMax}
        hint={`Up to ${LIMITS.bioMax} characters. Plain text only.`}
        defaultValue={pick("bio")}
        error={errors.bio}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="field-accountTypeLabel" className="text-base font-medium text-text">
          How you describe yourself (optional)
        </label>
        <select
          id="field-accountTypeLabel"
          name="accountTypeLabel"
          defaultValue={pick("accountTypeLabel")}
          aria-invalid={errors.accountTypeLabel ? true : undefined}
          aria-describedby="field-accountTypeLabel-hint"
          className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-text"
        >
          <option value="">Not specified</option>
          <option value="individual">Individual grower</option>
          <option value="breeder">Breeder</option>
          <option value="farm">Farm</option>
        </select>
        <p id="field-accountTypeLabel-hint" className="text-sm text-text-muted">
          A label for your profile only. It does not change what you can do.
        </p>
        {errors.accountTypeLabel ? (
          <p className="text-sm font-medium text-destructive">{errors.accountTypeLabel}</p>
        ) : null}
      </div>
      <FileField
        label="Profile photo (optional)"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        hint="JPEG, PNG or WebP, up to 2 MB. Leave empty to keep your current photo."
        error={errors.avatar}
      />

      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
