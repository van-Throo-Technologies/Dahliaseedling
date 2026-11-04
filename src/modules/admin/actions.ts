"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/capture/validation";
import { safeReturnPath } from "@/modules/messaging/validation";
import { accountFailure } from "@/modules/admin/account-failure";

/*
 * Administrator actions on a report. Each one names a report, not a free-form target, and the database checks is_admin() and
 * the target again. Removal is a soft delete; suspension goes through the Phase 1 authority. A visitor or grower who sends one
 * of these is refused by the database and sees a plain sentence.
 */

const REVIEW = "/admin/reports";
const STATUSES = ["reviewed", "actioned", "dismissed"] as const;

function failureOf(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("already been resolved")) return "alreadyResolved";
  if (message.includes("only a public Update")) return "notRemovable";
  if (message.includes("cannot suspend your own")) return "ownAccount";
  if (error?.code === "42501") return "notAllowed";
  if (error?.code === "P0002") return "notFound";
  return "generic";
}

function withQuery(path: string, query: string): string {
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

function back(returnTo: string, query: string): never {
  revalidatePath(REVIEW);
  redirect(withQuery(returnTo, query));
}

function reportIdOf(formData: FormData): string | null {
  const id = String(formData.get("reportId") ?? "");
  return isUuid(id) ? id : null;
}

export async function resolveReportAction(formData: FormData): Promise<never> {
  const returnTo = safeReturnPath(formData.get("returnTo"), REVIEW);
  const reportId = reportIdOf(formData);
  const status = String(formData.get("status") ?? "");
  if (!reportId || !(STATUSES as readonly string[]).includes(status))
    back(returnTo, "adminError=notFound");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("resolve_report", { p_report_id: reportId, p_status: status });
  if (error) back(returnTo, `adminError=${failureOf(error)}`);
  back(returnTo, "adminNotice=resolved");
}

export async function removeContentAction(formData: FormData): Promise<never> {
  const returnTo = safeReturnPath(formData.get("returnTo"), REVIEW);
  const reportId = reportIdOf(formData);
  if (!reportId) back(returnTo, "adminError=notFound");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("admin_remove_content", { p_report_id: reportId });
  if (error) back(returnTo, `adminError=${failureOf(error)}`);
  back(returnTo, "adminNotice=removed");
}

export async function setReportedSuspensionAction(formData: FormData): Promise<never> {
  const returnTo = safeReturnPath(formData.get("returnTo"), REVIEW);
  const reportId = reportIdOf(formData);
  if (!reportId) back(returnTo, "adminError=notFound");
  const suspend = String(formData.get("suspend") ?? "") === "1";
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("admin_set_reported_suspension", {
    p_report_id: reportId,
    p_suspended: suspend,
  });
  if (error) back(returnTo, `adminError=${failureOf(error)}`);
  back(returnTo, `adminNotice=${suspend ? "suspended" : "restored"}`);
}

const ACCOUNTS = "/admin/accounts";

/*
 * Direct suspension of an account, without a report. The database requires an administrator, refuses a self-suspension, requires a
 * reason of 10 to 500 characters, and writes the audit row in the same transaction. The reason is not logged or echoed in the address.
 */
export async function suspendProfileAction(formData: FormData): Promise<never> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "");
  const suspend = String(formData.get("suspend") ?? "") === "1";
  if (!isUuid(profileId)) redirect(`${ACCOUNTS}?adminError=notFound`);
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("admin_suspend_profile", {
    p_profile_id: profileId,
    p_suspended: suspend,
    p_reason: reason,
  });
  revalidatePath(ACCOUNTS);
  if (error) redirect(`${ACCOUNTS}?adminError=${accountFailure(error)}`);
  redirect(`${ACCOUNTS}?adminNotice=${suspend ? "suspended" : "restored"}`);
}
