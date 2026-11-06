"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { translateFields } from "@/i18n/message";
import { getTranslation } from "@/i18n/server";
import { logEvent } from "@/lib/logging/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdministrator } from "@/modules/admin/repository";
import { isUuid } from "@/modules/capture/validation";
import type { FormState } from "@/modules/identity/form-state";
import { isHoneypotFilled, validateInvitationRequest } from "./validation";

/*
 * Invitation requests. A visitor's request is stored as pending by a database function that answers the same way for a new request and
 * for a repeat, so the response reveals nothing about other requests or accounts. Approval and the record that an invitation was sent
 * are administrator-only, and each one is refused by the database unless the caller is an administrator.
 *
 * Logs carry an outcome and a code only. A name, an address or a reason is never logged.
 */

const ADMIN_PATH = "/admin/invitations";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function submitInvitationRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { t } = await getTranslation();
  const values = {
    name: text(formData, "name"),
    countryCode: text(formData, "countryCode"),
    email: text(formData, "email"),
    reason: text(formData, "reason"),
  };

  // A filled honeypot is an automated submission. It gets the same answer as a real one, and nothing is stored.
  if (isHoneypotFilled(formData.get("website"))) {
    logEvent("warn", "invitation_request", { outcome: "refused", code: "honeypot", route: "join" });
    return { status: "saved", message: t("invitations.join.received") };
  }

  const input = validateInvitationRequest(values);
  if (!input.ok) {
    return {
      status: "error",
      fieldErrors: translateFields(t, input.fieldErrors),
      message: t("errors.checkFields"),
      values,
    };
  }

  const clientKey = text(formData, "clientKey");
  if (!isUuid(clientKey)) {
    return {
      status: "error",
      fieldErrors: {},
      message: t("invitations.join.genericError"),
      values,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_invitation_request", {
    p_client_key: clientKey,
    p_name: input.value.name,
    p_country: input.value.countryCode,
    p_email: input.value.email,
    p_reason: input.value.reason,
  });

  if (error) {
    logEvent("error", "invitation_request", {
      outcome: "failed",
      code: "store_failed",
      route: "join",
    });
    return {
      status: "error",
      fieldErrors: {},
      message: t("invitations.join.genericError"),
      values,
    };
  }
  if (data === "limited") {
    logEvent("warn", "invitation_request", {
      outcome: "refused",
      code: "daily_limit",
      route: "join",
    });
    return { status: "error", fieldErrors: {}, message: t("invitations.join.limited"), values };
  }

  logEvent("info", "invitation_request", { outcome: "received", route: "join" });
  return { status: "saved", message: t("invitations.join.received") };
}

/** The logger accepts lowercase codes only, so a camel-case code is written in snake case. */
function logCode(code: string): string {
  return code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Sends the visitor back to the review page with a short code. Only codes are passed in the address, never text. */
function back(query: string): never {
  redirect(`${ADMIN_PATH}?${query}`);
}

async function administratorClient() {
  const supabase = await createSupabaseServerClient();
  if (!(await isAdministrator(supabase))) back("error=notAllowed");
  return supabase;
}

/** Approves or declines one pending request. Approval records the decision only; the invitation is sent from Supabase. */
export async function decideInvitationRequestAction(formData: FormData): Promise<never> {
  const requestId = text(formData, "requestId");
  const decision = text(formData, "decision");
  if (!isUuid(requestId) || (decision !== "approve" && decision !== "decline"))
    back("error=notFound");

  const supabase = await administratorClient();
  const { error } = await supabase.rpc("admin_decide_invitation_request", {
    p_request_id: requestId,
    p_decision: decision,
  });
  revalidatePath(ADMIN_PATH);

  if (error) {
    const code =
      error.code === "42501"
        ? "notAllowed"
        : error.code === "P0002"
          ? "notFound"
          : error.code === "55000"
            ? "alreadyDecided"
            : "generic";
    logEvent("warn", "invitation_decision", {
      outcome: "refused",
      code: logCode(code),
      route: "admin.invitations",
    });
    back(`error=${code}`);
  }
  logEvent("info", "invitation_decision", {
    outcome: decision === "approve" ? "approved" : "declined",
    route: "admin.invitations",
  });
  back(`notice=${decision === "approve" ? "approved" : "declined"}`);
}

/** Records that the invitation for an approved request has been sent. It can be recorded once. */
export async function markInvitationSentAction(formData: FormData): Promise<never> {
  const requestId = text(formData, "requestId");
  if (!isUuid(requestId)) back("error=notFound");

  const supabase = await administratorClient();
  const { error } = await supabase.rpc("admin_mark_invitation_sent", { p_request_id: requestId });
  revalidatePath(ADMIN_PATH);

  if (error) {
    const code =
      error.code === "42501" ? "notAllowed" : error.code === "55000" ? "notApproved" : "generic";
    logEvent("warn", "invitation_sent", {
      outcome: "refused",
      code: logCode(code),
      route: "admin.invitations",
    });
    back(`error=${code}`);
  }
  logEvent("info", "invitation_sent", { outcome: "recorded", route: "admin.invitations" });
  back("notice=sent");
}
