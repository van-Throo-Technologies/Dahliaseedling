"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRateLimited } from "@/lib/errors/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Deactivation and erasure. Each action asks the database to do the work, so the rules are enforced there. The browser only shows a
 * confirmed request. Errors become a stable key; the database text is never shown.
 */

const PAGE = "/privacy";

function failureKey(error: { code?: string } | null): string {
  if (isRateLimited(error)) return "generic";
  if (error?.code === "42501") return "notAllowed";
  if (error?.code === "23514") return "notDeactivated";
  return "generic";
}

function back(query: string): never {
  revalidatePath(PAGE);
  redirect(`${PAGE}?${query}`);
}

export async function deactivateAccountAction(formData: FormData): Promise<never> {
  if (String(formData.get("confirm") ?? "") !== "yes") back("privacyError=notConfirmed");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("deactivate_my_account");
  if (error) back(`privacyError=${failureKey(error)}`);
  back("privacyNotice=deactivated");
}

export async function requestErasureAction(formData: FormData): Promise<never> {
  if (String(formData.get("confirm") ?? "") !== "yes") back("privacyError=notConfirmed");
  const client = await createSupabaseServerClient();
  const { data: avatarPath, error } = await client.rpc("request_my_erasure");
  if (error) back(`privacyError=${failureKey(error)}`);

  // The avatar object is removed through the grower's own storage session, which the storage policy allows. The step is recorded only
  // after the removal succeeds, so a failed removal still shows as outstanding rather than being reported as done.
  if (typeof avatarPath === "string" && avatarPath !== "") {
    const { error: removeError } = await client.storage.from("avatars").remove([avatarPath]);
    if (!removeError) await client.rpc("record_my_avatar_removed");
  }
  back("privacyNotice=erasureRequested");
}
