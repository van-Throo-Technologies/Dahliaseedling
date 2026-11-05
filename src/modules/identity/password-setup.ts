import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/*
 * True only for a signed-in account that was invited and has not chosen a password yet. The database decides, from the stored password
 * state of the caller's own account. Any error is treated as false, so a failed check refuses the change rather than allowing it.
 */
export async function invitationPasswordPending(client: Client): Promise<boolean> {
  const { data, error } = await client.rpc("invitation_password_pending");
  return error === null && data === true;
}
