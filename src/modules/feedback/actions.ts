"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import { isRateLimited } from "@/lib/errors/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_BUILD } from "@/lib/build-info";
import { isUuid } from "@/modules/capture/validation";
import type { FormState } from "@/modules/identity/form-state";
import { isFeedbackCategory, isFeedbackMessageValid } from "./validation";

/*
 * Sending feedback returns the form state, so the typed text is kept on an error. The database decides who may send and enforces the
 * limit, and it takes the author from the session. The page context is only a path, which the database reduces further.
 */

function refusalKey(error: { code?: string } | null): "rateLimited" | "notAllowed" | "generic" {
  if (isRateLimited(error)) return "rateLimited";
  if (error?.code === "42501") return "notAllowed";
  return "generic";
}

export async function submitFeedbackAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getTranslation();
  const category = String(formData.get("category") ?? "");
  const message = String(formData.get("message") ?? "");
  const clientKey = String(formData.get("clientKey") ?? "");
  const from = String(formData.get("from") ?? "");
  const values = { category, message, from };

  const fieldErrors: Record<string, string> = {};
  if (!isFeedbackCategory(category)) fieldErrors.category = t("feedback.errors.category");
  if (!isFeedbackMessageValid(message)) fieldErrors.message = t("feedback.errors.message");
  if (Object.keys(fieldErrors).length > 0) return { status: "error", fieldErrors, values };
  if (!isUuid(clientKey))
    return { status: "error", fieldErrors: {}, message: t("feedback.errors.generic"), values };

  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("submit_feedback", {
    p_client_key: clientKey,
    p_category: category,
    p_message: message,
    p_page_context: from.length > 0 ? from : undefined,
    p_app_version: APP_BUILD,
  });
  if (error) {
    return {
      status: "error",
      fieldErrors: {},
      message: t(`feedback.errors.${refusalKey(error)}`),
      values,
    };
  }
  return { status: "saved", message: t("feedback.sent") };
}

const REVIEW = "/admin/feedback";
const STATUSES = ["new", "reviewing", "resolved"] as const;

/** Changes one feedback item's status. Returns to the same filtered list. */
export async function setFeedbackStatusAction(formData: FormData): Promise<never> {
  const id = String(formData.get("feedbackId") ?? "");
  const status = String(formData.get("status") ?? "");
  const category = String(formData.get("category") ?? "");
  const filter = String(formData.get("statusFilter") ?? "");
  const query = new URLSearchParams();
  if (isFeedbackCategory(category)) query.set("category", category);
  if ((STATUSES as readonly string[]).includes(filter)) query.set("status", filter);

  if (!isUuid(id) || !(STATUSES as readonly string[]).includes(status)) {
    redirect(`${REVIEW}?${query.toString()}${query.toString() ? "&" : ""}feedbackError=notFound`);
  }
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("admin_set_feedback_status", {
    p_feedback_id: id,
    p_status: status,
  });
  revalidatePath(REVIEW);
  const suffix = query.toString() ? "&" : "";
  if (error) {
    const key =
      error.code === "42501" ? "notAllowed" : error.code === "P0002" ? "notFound" : "generic";
    redirect(`${REVIEW}?${query.toString()}${suffix}feedbackError=${key}`);
  }
  redirect(`${REVIEW}?${query.toString()}${suffix}feedbackNotice=updated`);
}
