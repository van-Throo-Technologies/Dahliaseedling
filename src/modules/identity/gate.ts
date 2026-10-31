import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, getOwnProfile } from "./session";
import type { Profile } from "./profile-repository";

/*
 * The participation gate. Browsing is open to everyone; anything that creates or changes data
 * goes through one of these functions so the rule lives in one place.
 *
 * A visitor is sent to sign in, then to profile setup if needed, then back to `returnTo`, so the
 * action they were attempting is preserved where practical.
 */

function withNext(path: string, returnTo: string): string {
  return `${path}?next=${encodeURIComponent(returnTo)}`;
}

/** Requires a signed-in user with a profile. A suspended user still passes. */
export async function requireAccount(
  returnTo: string,
): Promise<{ userId: string; profile: Profile }> {
  const user = await getCurrentUser();
  if (!user) redirect(withNext("/sign-in", returnTo));

  const profile = await getOwnProfile();
  if (!profile) redirect(withNext("/profile/setup", returnTo));

  return { userId: user.id, profile };
}

/** Requires an account that is allowed to take part (not suspended). */
export async function requireParticipant(
  returnTo: string,
): Promise<{ userId: string; profile: Profile }> {
  const context = await requireAccount(returnTo);
  if (context.profile.isSuspended) redirect("/profile?notice=suspended");
  return context;
}
