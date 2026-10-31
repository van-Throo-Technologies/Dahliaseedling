import "server-only";

import { cache } from "react";
import { ConfigError } from "@/lib/config/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findProfile, type Profile } from "./profile-repository";

/*
 * Data access layer for the current visitor. React's cache() dedupes these within one render;
 * server actions run outside a render, so they call the functions directly.
 *
 * getUser() validates the session with Supabase Auth. Nothing here trusts a user id from the
 * request.
 */

export const getCurrentUser = cache(async () => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch (error) {
    // Without configuration every visitor is treated as signed out, so public pages still
    // render. /api/health reports the misconfiguration.
    if (error instanceof ConfigError) return null;
    throw error;
  }
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** The signed-in user's own profile, or null if it has not been created yet. */
export const getOwnProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  return findProfile(supabase, user.id);
});

/** A public profile as any visitor sees it. RLS hides suspended and missing profiles. */
export async function getPublicProfile(id: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  return findProfile(supabase, id);
}
