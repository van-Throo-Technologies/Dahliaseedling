import { COUNTRIES } from "./country-codes";

/*
 * Pure validation for identity input. The same rules are repeated as database CHECK constraints
 * (see supabase/migrations), so a bypassed UI still cannot store bad data.
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
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmail(raw: FormDataEntryValue | null): ValidationResult<string> {
  const email = clean(raw).toLowerCase();
  if (email === "") return fail("email", "Enter your email address.");
  if (email.length > LIMITS.emailMax || !EMAIL_PATTERN.test(email)) {
    return fail("email", "Enter an email address in the form name@example.com.");
  }
  return { ok: true, value: email };
}

export function validatePassword(raw: FormDataEntryValue | null): ValidationResult<string> {
  const password = typeof raw === "string" ? raw : "";
  if (password.length < LIMITS.passwordMin) {
    return fail("password", `Use at least ${LIMITS.passwordMin} characters.`);
  }
  if (new TextEncoder().encode(password).length > LIMITS.passwordMaxBytes) {
    return fail("password", "Use a shorter password.");
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
  const errors: Record<string, string> = {};

  const displayName = clean(form.get("displayName"));
  if (displayName.length < LIMITS.displayNameMin || displayName.length > LIMITS.displayNameMax) {
    errors.displayName = `Use ${LIMITS.displayNameMin} to ${LIMITS.displayNameMax} characters.`;
  }

  const countryCode = clean(form.get("countryCode")).toUpperCase();
  if (!COUNTRIES.some((country) => country.code === countryCode)) {
    errors.countryCode = "Choose your country from the list.";
  }

  const regionCity = clean(form.get("regionCity"));
  if (regionCity.length > LIMITS.regionCityMax) {
    errors.regionCity = `Use ${LIMITS.regionCityMax} characters or fewer.`;
  }

  const bio = clean(form.get("bio"));
  if (bio.length > LIMITS.bioMax) {
    errors.bio = `Use ${LIMITS.bioMax} characters or fewer.`;
  }

  const accountTypeRaw = clean(form.get("accountTypeLabel"));
  const accountTypeLabel = ACCOUNT_TYPE_LABELS.find((label) => label === accountTypeRaw) ?? null;
  if (accountTypeRaw !== "" && accountTypeLabel === null) {
    errors.accountTypeLabel = "Choose one of the listed options.";
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
    return fail("avatar", "Choose a JPEG, PNG or WebP image.");
  }
  if (raw.size > LIMITS.avatarMaxBytes) {
    return fail("avatar", "Choose an image of 2 MB or smaller.");
  }
  return { ok: true, value: raw };
}

function fail(field: string, message: string): { ok: false; fieldErrors: Record<string, string> } {
  return { ok: false, fieldErrors: { [field]: message } };
}
