"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/capture/validation";
import { isRateLimited } from "@/lib/errors/rate-limit";
import { refuseOnPublicSurface } from "@/lib/security/public-action-guard";

/*
 * Continuation actions. Each one calls a database function, which decides who may do what and enforces the state
 * machine, the locking and the transfer boundary. The action only shapes the input and turns the outcome into a
 * notice or a stable failure key. It never trusts a recipient or holder id supplied by the browser: the function
 * compares the caller with the stored state.
 */

export type RehomeFailure =
  "notAllowed" | "notAvailable" | "makePublicFirst" | "note" | "rateLimited" | "generic";

/** Turns a database error into one of the stable failure keys. The database text itself is never shown. */
function failureOf(error: { code?: string; message?: string } | null): RehomeFailure {
  const message = error?.message ?? "";
  if (message.includes("make the seedling public")) return "makePublicFirst";
  if (message.includes("notes are")) return "note";
  if (isRateLimited(error)) return "rateLimited";
  if (error?.code === "42501") return "notAllowed";
  if (error?.code === "P0001" || error?.code === "P0002" || error?.code === "23505")
    return "notAvailable";
  return "generic";
}

function back(seedlingId: string, query: string): never {
  revalidatePath(`/seedlings/${seedlingId}`);
  redirect(`/seedlings/${seedlingId}?${query}`);
}

function idsFrom(formData: FormData): { seedlingId: string; caseId: string } | null {
  const seedlingId = String(formData.get("seedlingId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  if (!isUuid(seedlingId) || !isUuid(caseId)) return null;
  return { seedlingId, caseId };
}

async function run(
  formData: FormData,
  call: (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    ids: { seedlingId: string; caseId: string },
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
  notice: string,
): Promise<never> {
  const ids = idsFrom(formData);
  if (!ids) back(String(formData.get("seedlingId") ?? ""), "rehomeError=generic");
  const client = await createSupabaseServerClient();
  const { error } = await call(client, ids);
  if (error) back(ids.seedlingId, `rehomeError=${failureOf(error)}`);
  back(ids.seedlingId, `rehome=${notice}`);
}

export async function startRehomeAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const seedlingId = String(formData.get("seedlingId") ?? "");
  if (!isUuid(seedlingId)) back(seedlingId, "rehomeError=generic");
  const client = await createSupabaseServerClient();
  const price = String(formData.get("priceText") ?? "");
  const handover = String(formData.get("handover") ?? "");
  const { error } = await client.rpc("start_rehome", {
    p_seedling_id: seedlingId,
    p_term: String(formData.get("term") ?? ""),
    p_price_text: price === "" ? undefined : price,
    p_handover: handover === "" ? undefined : handover,
    p_note: String(formData.get("note") ?? "") || undefined,
    p_make_public: formData.get("makePublic") === "on",
  });
  if (error) back(seedlingId, `rehomeError=${failureOf(error)}`);
  back(seedlingId, "rehome=started");
}

export async function expressInterestAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return run(
    formData,
    (client, ids) => client.rpc("express_rehome_interest", { p_case_id: ids.caseId }),
    "interestRecorded",
  );
}

export async function withdrawInterestAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return run(
    formData,
    (client, ids) => client.rpc("withdraw_rehome_interest", { p_case_id: ids.caseId }),
    "interestWithdrawn",
  );
}

export async function chooseRecipientAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const recipientId = String(formData.get("recipientId") ?? "");
  if (!isUuid(recipientId)) {
    back(String(formData.get("seedlingId") ?? ""), "rehomeError=generic");
  }
  return run(
    formData,
    (client, ids) =>
      client.rpc("choose_rehome_recipient", { p_case_id: ids.caseId, p_recipient_id: recipientId }),
    "chosen",
  );
}

export async function markSentAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return run(
    formData,
    (client, ids) => client.rpc("mark_rehome_sent", { p_case_id: ids.caseId }),
    "sent",
  );
}

export async function reopenAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return run(
    formData,
    (client, ids) => client.rpc("reopen_rehome", { p_case_id: ids.caseId }),
    "reopened",
  );
}

export async function withdrawAvailabilityAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return run(
    formData,
    (client, ids) => client.rpc("cancel_rehome", { p_case_id: ids.caseId }),
    "withdrawn",
  );
}

/** The selected recipient steps back while the arrangement is arranged. The holder stays, and the case is available again. */
export async function declineRecipientAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return run(
    formData,
    (client, ids) => client.rpc("decline_rehome", { p_case_id: ids.caseId }),
    "declined",
  );
}

/** Receipt is the transfer boundary. The database answers "completed", "already_completed" or "stale". */
export async function confirmReceiptAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const ids = idsFrom(formData);
  if (!ids) back(String(formData.get("seedlingId") ?? ""), "rehomeError=generic");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("confirm_rehome_received", { p_case_id: ids.caseId });
  if (error) back(ids.seedlingId, `rehomeError=${failureOf(error)}`);
  const outcome = String(data);
  back(
    ids.seedlingId,
    `rehome=${outcome === "completed" ? "received" : outcome === "already_completed" ? "alreadyReceived" : "stale"}`,
  );
}
