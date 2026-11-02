"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import { translateFields, type Msg } from "@/i18n/message";
import { safeNextPath } from "@/lib/http/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "./gate";
import type { FormState } from "./form-state";
import {
  insertOwnProfile,
  removeAvatar,
  updateOwnProfile,
  uploadAvatar,
} from "./profile-repository";
import { getCurrentUser, getOwnProfile } from "./session";
import {
  validateAvatar,
  validateEmail,
  validatePassword,
  validateProfileInput,
} from "./validation";

/*
 * Server actions for sign-in, sign-up, sign-out and profile writes.
 *
 * Every action validates input here, on the server, before any database call. Identity always
 * comes from the verified session, never from a form field. Redirect targets pass safeNextPath.
 * Messages are translated here, in the visitor's language, before they reach the form.
 */

const PROFILE_TEXT_FIELDS = ["displayName", "countryCode", "regionCity", "bio", "accountTypeLabel"];

function nextFrom(formData: FormData): string {
  return safeNextPath(formData.get("next"), "/");
}

/** Non-sensitive text fields to echo back after a failed submit. Never includes passwords. */
function echo(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

/** After authenticating, go to profile setup when needed, otherwise to the intended destination. */
async function continueAfterAuthentication(next: string): Promise<never> {
  const profile = await getOwnProfile();
  if (!profile) redirect(`/profile/setup?next=${encodeURIComponent(next)}`);
  redirect(next);
}

async function invalid(
  fields: Readonly<Record<string, Msg>>,
  values: Record<string, string> = {},
): Promise<FormState> {
  const { t } = await getTranslation();
  return {
    status: "error",
    fieldErrors: translateFields(t, fields),
    message: t("errors.checkFields"),
    values,
  };
}

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getTranslation();
  const email = validateEmail(formData.get("email"));
  const password = formData.get("password");

  const fieldErrors: Record<string, Msg> = {};
  if (!email.ok) Object.assign(fieldErrors, email.fieldErrors);
  if (typeof password !== "string" || password === "") {
    fieldErrors.password = { key: "identity.signIn.passwordRequired" };
  }
  if (!email.ok || typeof password !== "string" || Object.keys(fieldErrors).length > 0) {
    return invalid(fieldErrors, echo(formData, ["email"]));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.value, password });
  if (error) {
    return {
      status: "error",
      fieldErrors: {},
      message: t("identity.signIn.badCredentials"),
      values: echo(formData, ["email"]),
    };
  }

  return continueAfterAuthentication(nextFrom(formData));
}

export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getTranslation();
  const email = validateEmail(formData.get("email"));
  const password = validatePassword(formData.get("password"));

  if (!email.ok || !password.ok) {
    return invalid(
      {
        ...(email.ok ? {} : email.fieldErrors),
        ...(password.ok ? {} : password.fieldErrors),
      },
      echo(formData, ["email"]),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  });
  if (error) {
    return {
      status: "error",
      fieldErrors: {},
      message: t("identity.signUp.genericError"),
      values: echo(formData, ["email"]),
    };
  }

  // With email confirmation on, there is no session yet. The user confirms, then signs in.
  if (!data.session) {
    return { status: "saved", message: t("identity.signUp.saved") };
  }

  return continueAfterAuthentication(nextFrom(formData));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const next = nextFrom(formData);
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent("/profile/setup")}`);

  // Setting up twice (for example after a refresh) simply continues to the destination.
  if (await getOwnProfile()) redirect(next);

  const input = validateProfileInput(formData);
  if (!input.ok) return invalid(input.fieldErrors, echo(formData, PROFILE_TEXT_FIELDS));

  const supabase = await createSupabaseServerClient();
  await insertOwnProfile(supabase, user.id, input.value);
  redirect(next);
}

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { userId, profile: current } = await requireParticipant("/profile/edit");
  const { t } = await getTranslation();

  const input = validateProfileInput(formData);
  const avatar = validateAvatar(formData.get("avatar"));
  if (!input.ok || !avatar.ok) {
    return invalid(
      {
        ...(input.ok ? {} : input.fieldErrors),
        ...(avatar.ok ? {} : avatar.fieldErrors),
      },
      echo(formData, PROFILE_TEXT_FIELDS),
    );
  }

  const supabase = await createSupabaseServerClient();

  let newAvatarPath: string | undefined;
  if (avatar.value) {
    newAvatarPath = await uploadAvatar(supabase, userId, avatar.value);
  }

  let updated = null;
  try {
    updated = await updateOwnProfile(supabase, userId, input.value, newAvatarPath);
  } catch {
    updated = null;
  }

  if (!updated) {
    // Do not leave an orphaned upload behind when the profile was not changed.
    if (newAvatarPath) await removeAvatar(supabase, newAvatarPath);
    return {
      status: "error",
      fieldErrors: {},
      message: t("identity.edit.saveError"),
      values: echo(formData, PROFILE_TEXT_FIELDS),
    };
  }

  if (newAvatarPath && current.avatarPath) {
    await removeAvatar(supabase, current.avatarPath);
  }

  revalidatePath("/profile");
  revalidatePath(`/profiles/${userId}`);
  return { status: "saved", message: t("identity.edit.saved") };
}
