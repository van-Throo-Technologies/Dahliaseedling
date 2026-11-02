import { msg, type Msg } from "@/i18n/message";
import { COUNTRY_CODES } from "./country-codes";

/*
 * Pure validation for identity input. The same rules are repeated as database CHECK constraints
 * (see supabase/migrations), so a bypassed UI still cannot store bad data. Messages are keys, translated at the edge.
 */

export const LIMITS = {
  emailMax: 254,
  passwordMin: 8,
  /** bcrypt, used by Supabase Auth, ignores bytes beyond 72. */
  passwordMaxBytes: 72,
  displayNameMin: 2,
  displayNameMax: 60,
  regionCityMax: 100,
  bioMax: 500,
  avatarMaxBytes: 2 * 1024 * 1024,
} as const;

export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCOUNT_TYPE_LABELS = ["individual", "breeder", "farm"] as const;
export type AccountTypeLabel = (typeof ACCOUNT_TYPE_LABELS)[number];

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, Msg>> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmail(raw: FormDataEntryValue | null): ValidationResult<string> {
  const email = clean(raw).toLowerCase();
  if (email === "") return fail("email", msg("validation.email.required"));
  if (email.length > LIMITS.emailMax || !EMAIL_PATTERN.test(email)) {
    return fail("email", msg("validation.email.format"));
  }
  return { ok: true, value: email };
}

export function validatePassword(raw: FormDataEntryValue | null): ValidationResult<string> {
  const password = typeof raw === "string" ? raw : "";
  if (password.length < LIMITS.passwordMin) {
    return fail("password", msg("validation.password.min", { min: LIMITS.passwordMin }));
  }
  if (new TextEncoder().encode(password).length > LIMITS.passwordMaxBytes) {
    return fail("password", msg("validation.password.tooLong"));
  }
  return { ok: true, value: password };
}

export interface ProfileInput {
  readonly displayName: string;
  readonly countryCode: string;
  readonly regionCity: string | null;
  readonly bio: string | null;
  readonly accountTypeLabel: AccountTypeLabel | null;
}

/** Validates the fields a participant may set on their own profile. */
export function validateProfileInput(form: FormData): ValidationResult<ProfileInput> {
  const errors: Record<string, Msg> = {};

  const displayName = clean(form.get("displayName"));
  if (displayName.length < LIMITS.displayNameMin || displayName.length > LIMITS.displayNameMax) {
    errors.displayName = msg("validation.displayName.range", {
      min: LIMITS.displayNameMin,
      max: LIMITS.displayNameMax,
    });
  }

  const countryCode = clean(form.get("countryCode")).toUpperCase();
  if (!COUNTRY_CODES.some((code) => code === countryCode)) {
    errors.countryCode = msg("validation.country.choose");
  }

  const regionCity = clean(form.get("regionCity"));
  if (regionCity.length > LIMITS.regionCityMax) {
    errors.regionCity = msg("validation.regionCity.max", { max: LIMITS.regionCityMax });
  }

  const bio = clean(form.get("bio"));
  if (bio.length > LIMITS.bioMax) {
    errors.bio = msg("validation.bio.max", { max: LIMITS.bioMax });
  }

  const accountTypeRaw = clean(form.get("accountTypeLabel"));
  const accountTypeLabel = ACCOUNT_TYPE_LABELS.find((label) => label === accountTypeRaw) ?? null;
  if (accountTypeRaw !== "" && accountTypeLabel === null) {
    errors.accountTypeLabel = msg("validation.accountType.choose");
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    value: {
      displayName,
      countryCode,
      regionCity: regionCity === "" ? null : regionCity,
      bio: bio === "" ? null : bio,
      accountTypeLabel,
    },
  };
}

/** Returns null when no avatar was chosen, so an existing avatar is kept. */
export function validateAvatar(raw: FormDataEntryValue | null): ValidationResult<File | null> {
  if (!(raw instanceof File) || raw.size === 0) return { ok: true, value: null };
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(raw.type)) {
    return fail("avatar", msg("validation.avatar.type"));
  }
  if (raw.size > LIMITS.avatarMaxBytes) {
    return fail("avatar", msg("validation.avatar.size"));
  }
  return { ok: true, value: raw };
}

function fail(field: string, message: Msg): { ok: false; fieldErrors: Record<string, Msg> } {
  return { ok: false, fieldErrors: { [field]: message } };
}
