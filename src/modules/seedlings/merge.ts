"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/capture/validation";
import { requireParticipant } from "@/modules/identity/gate";

/*
 * The merge action. The grower names the two records and says which one stays. The database decides everything else: the holder,
 * the originators, the continuation and offer blocks, the alerts, and the lock order. This action only shapes the input and turns the
 * outcome into a stable key. A refused merge changes nothing, because the function runs in one transaction.
 */

type MergeFailure =
  | "notAllowed"
  | "notFound"
  | "notConfirmed"
  | "retired"
  | "differentOriginators"
  | "continuation"
  | "offer"
  | "alerts"
  | "generic";

function failureOf(error: { code?: string; message?: string } | null): MergeFailure {
  const message = error?.message ?? "";
  if (message.includes("confirm the merge")) return "notConfirmed";
  if (message.includes("different originators")) return "differentOriginators";
  if (message.includes("finish or cancel the continuation")) return "continuation";
  if (message.includes("close the seed offers")) return "offer";
  if (message.includes("availability alerts")) return "alerts";
  if (
    message.includes("already merged") ||
    message.includes("retired seedling") ||
    message.includes("different seedlings")
  )
    return "retired";
  if (error?.code === "42501") return "notAllowed";
  if (error?.code === "P0002") return "notFound";
  return "generic";
}

export async function mergeSeedlingsAction(formData: FormData): Promise<never> {
  const thisId = String(formData.get("thisId") ?? "");
  const otherId = String(formData.get("otherId") ?? "");
  const keep = String(formData.get("keep") ?? "");
  const confirmed = formData.get("confirmed") === "on";
  const page = `/seedlings/${thisId}/merge`;
  await requireParticipant(page);
  if (!isUuid(thisId) || !isUuid(otherId) || (keep !== "this" && keep !== "other")) {
    redirect(`${page}?mergeError=notFound`);
  }

  const [canonicalId, duplicateId] = keep === "this" ? [thisId, otherId] : [otherId, thisId];
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("merge_seedlings", {
    p_canonical: canonicalId,
    p_duplicate: duplicateId,
    p_confirmed: confirmed,
  });
  if (error) redirect(`${page}?mergeError=${failureOf(error)}`);

  revalidatePath(`/seedlings/${canonicalId}`);
  revalidatePath(`/seedlings/${duplicateId}`);
  redirect(`/seedlings/${canonicalId}?mergeNotice=done`);
}
