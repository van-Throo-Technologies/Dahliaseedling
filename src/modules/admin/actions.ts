"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/capture/validation";
import { safeReturnPath } from "@/modules/messaging/validation";

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
