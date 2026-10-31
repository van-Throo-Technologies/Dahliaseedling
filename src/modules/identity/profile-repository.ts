import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountTypeLabel, ProfileInput } from "./validation";

/*
 * Database operations for profiles. Each function runs with the caller's own Supabase session,
 * so RLS decides what is allowed. Callers pass only validated input, and the user id always
 * comes from the verified session, never from the request.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface Profile {
  readonly id: string;
  readonly displayName: string;
  readonly avatarPath: string | null;
  readonly countryCode: string;
  readonly regionCity: string | null;
  readonly bio: string | null;
  readonly accountTypeLabel: AccountTypeLabel | null;
  readonly isSuspended: boolean;
  readonly createdAt: string;
}

const PROFILE_COLUMNS =
  "id, display_name, avatar_path, country_code, region_city, bio, account_type_label, is_suspended, created_at, updated_at";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    countryCode: row.country_code,
    regionCity: row.region_city,
    bio: row.bio,
    accountTypeLabel: row.account_type_label as AccountTypeLabel | null,
    isSuspended: row.is_suspended,
    createdAt: row.created_at,
  };
}

/** Returns the profile visible to the current session, or null (missing, suspended, or hidden). */
export async function findProfile(client: Client, userId: string): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not read profile: ${error.code}`);
  return data ? toProfile(data) : null;
}

export async function insertOwnProfile(
  client: Client,
  userId: string,
  input: Pick<ProfileInput, "displayName" | "countryCode">,
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .insert({
      id: userId,
      display_name: input.displayName,
      country_code: input.countryCode,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw new Error(`Could not create profile: ${error.code}`);
  return toProfile(data);
}

/** Returns the updated profile, or null when RLS allowed no row to change. */
export async function updateOwnProfile(
  client: Client,
  userId: string,
  input: ProfileInput,
  avatarPath: string | null | undefined,
): Promise<Profile | null> {
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {
    display_name: input.displayName,
    country_code: input.countryCode,
    region_city: input.regionCity,
    bio: input.bio,
    account_type_label: input.accountTypeLabel,
  };
  if (avatarPath !== undefined) patch.avatar_path = avatarPath;

  const { data, error } = await client
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Could not update profile: ${error.code}`);
  return data ? toProfile(data) : null;
}

/** Uploads an avatar under the user's own folder and returns the storage path. */
export async function uploadAvatar(client: Client, userId: string, file: File): Promise<string> {
  const extension = extensionFor(file.type);
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error(`Could not upload avatar: ${error.message}`);
  return path;
}

/** Best-effort cleanup. A failure here leaves an unused file, never a broken profile. */
export async function removeAvatar(client: Client, path: string): Promise<void> {
  await client.storage.from("avatars").remove([path]);
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      throw new Error("Unsupported avatar type");
  }
}
