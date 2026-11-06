"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/server";
import { isUuid } from "@/modules/capture/validation";
import { requireParticipant } from "@/modules/identity/gate";
import {
  checkMessage,
  checkPhoto,
  checkReport,
  REPORT_TARGETS,
  safeReturnPath,
} from "./validation";
import { isRateLimited } from "@/lib/errors/rate-limit";
import { refuseOnPublicSurface } from "@/lib/security/public-action-guard";

/*
 * Messaging, reporting, blocking and availability subscriptions. Each action signs the caller in, checks the shape of its
 * input, and calls one database function. The function decides who may do what; the action only turns the outcome into a
 * stable key in the address bar. Database text is never shown, so a visitor sees a plain sentence and nothing internal.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Turns a database error into a stable key. The database message is matched, never displayed. */
function failureOf(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("not available between these growers")) return "blocked";
  if (message.includes("a message needs text")) return "empty";
  if (message.includes("2000 characters")) return "tooLong";
  if (message.includes("must be an image")) return "photoType";
  if (message.includes("choose a reason")) return "reason";
  if (message.includes("details are")) return "details";
  if (message.includes("cannot report your own")) return "self";
  if (isRateLimited(error)) return "rateLimited";
  if (error?.code === "42501") return "notAllowed";
  if (error?.code === "P0002") return "notFound";
  if (error?.code === "23514") return "unavailable";
  return "generic";
}

function addQuery(path: string, query: string): string {
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

function withFailure(path: string, key: string): never {
  redirect(addQuery(path, `messagingError=${key}`));
}

/** Removes uploads whose message was not sent. Best effort: the photograph is private to its owner either way. */
async function discardUploads(client: Client, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await client.storage.from("private-media").remove([...paths]);
  } catch {
    // Nothing is shared, so a failed cleanup is not shown to the grower.
  }
}

/** Starts or opens the conversation for one context. The database finds the existing thread or creates it once. */
export async function startConversationAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const returnTo = safeReturnPath(formData.get("returnTo"), "/inbox");
  await requireParticipant(returnTo);
  const kind = String(formData.get("kind") ?? "");
  const target = String(formData.get("target") ?? "");
  const other = String(formData.get("other") ?? "");
  if (!isUuid(target)) withFailure(returnTo, "notFound");
  if ((kind === "rehome" || kind === "seedOffer") && !isUuid(other))
    withFailure(returnTo, "notFound");

  const client = await createSupabaseServerClient();
  let result: { data: unknown; error: { code?: string; message?: string } | null };
  if (kind === "direct")
    result = await client.rpc("start_direct_conversation", { p_other: target });
  else if (kind === "seedling")
    result = await client.rpc("start_seedling_conversation", { p_seedling_id: target });
  else if (kind === "rehome")
    result = await client.rpc("start_rehome_conversation", { p_case_id: target, p_with: other });
  else if (kind === "seedOffer")
    result = await client.rpc("start_seed_offer_conversation", {
      p_offer_id: target,
      p_with: other,
    });
  else withFailure(returnTo, "generic");

  if (result.error) withFailure(returnTo, failureOf(result.error));
  revalidatePath("/inbox");
  redirect(`/inbox/${String(result.data)}`);
}

/** Sends one message, with an optional photograph. The client key makes a repeated submission return the same message. */
export async function sendMessageAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!isUuid(conversationId)) redirect("/inbox?messagingError=notFound");
  const thread = `/inbox/${conversationId}`;
  const { userId } = await requireParticipant(thread);

  const clientKey = String(formData.get("clientKey") ?? "");
  if (!isUuid(clientKey)) withFailure(thread, "generic");

  const photo = formData.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  const text = checkMessage(String(formData.get("body") ?? ""), file !== null);
  if (!text.ok) withFailure(thread, text.key);

  const client = await createSupabaseServerClient();
  let photoId: string | null = null;
  const uploaded: string[] = [];
  if (file) {
    const check = checkPhoto(file);
    if (!check.ok) withFailure(thread, check.key);
    const extension =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from("private-media")
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) withFailure(thread, "generic");
    uploaded.push(path);
    const { data, error } = await client.rpc("register_message_photo", { p_path: path });
    if (error || !data) {
      await discardUploads(client, uploaded);
      withFailure(thread, failureOf(error));
    }
    photoId = String(data);
  }

  const { error } = await client.rpc("send_message", {
    p_conversation_id: conversationId,
    p_client_key: clientKey,
    p_body: text.value ?? undefined,
    p_photo_media_id: photoId ?? undefined,
  });
  if (error) {
    await discardUploads(client, uploaded);
    withFailure(thread, failureOf(error));
  }
  revalidatePath("/inbox");
  revalidatePath(thread);
  redirect(addQuery(thread, "messagingNotice=sent"));
}

async function setBlock(formData: FormData, block: boolean): Promise<never> {
  const returnTo = safeReturnPath(formData.get("returnTo"), "/inbox");
  await requireParticipant(returnTo);
  const target = String(formData.get("target") ?? "");
  if (!isUuid(target)) withFailure(returnTo, "notFound");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc(block ? "block_user" : "unblock_user", { p_target: target });
  if (error) withFailure(returnTo, failureOf(error));
  revalidatePath("/inbox");
  revalidatePath(returnTo);
  redirect(addQuery(returnTo, `messagingNotice=${block ? "blocked" : "unblocked"}`));
}

export async function blockGrowerAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return setBlock(formData, true);
}

export async function unblockGrowerAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  return setBlock(formData, false);
}

/** Sends a report. The reported grower is never told; the reviewer sees the snapshot the database keeps. */
export async function reportAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const returnTo = safeReturnPath(formData.get("returnTo"), "/inbox");
  await requireParticipant(returnTo);
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!isUuid(targetId) || !(REPORT_TARGETS as readonly string[]).includes(targetType)) {
    withFailure(returnTo, "notFound");
  }
  const check = checkReport(
    String(formData.get("reason") ?? ""),
    String(formData.get("details") ?? ""),
  );
  if (!check.ok) withFailure(returnTo, check.key);
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("create_report", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: check.value.reason,
    p_details: check.value.details ?? undefined,
  });
  if (error) withFailure(returnTo, failureOf(error));
  redirect(addQuery(returnTo, "messagingNotice=reported"));
}

/** Subscribes to, or leaves, the availability alert for one public Seedling. */
export async function setAvailabilityAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  const returnTo = safeReturnPath(formData.get("returnTo"), "/inbox");
  await requireParticipant(returnTo);
  const seedlingId = String(formData.get("seedlingId") ?? "");
  if (!isUuid(seedlingId)) withFailure(returnTo, "notFound");
  const subscribe = String(formData.get("subscribe") ?? "") === "1";
  const client = await createSupabaseServerClient();
  // The language the grower is reading now is kept with the subscription, for the availability email only.
  const { error } = subscribe
    ? await client.rpc("subscribe_availability", {
        p_seedling_id: seedlingId,
        p_locale: await getLocale(),
      })
    : await client.rpc("unsubscribe_availability", { p_seedling_id: seedlingId });
  if (error) withFailure(returnTo, failureOf(error));
  revalidatePath(returnTo);
  redirect(addQuery(returnTo, `messagingNotice=${subscribe ? "subscribed" : "unsubscribed"}`));
}
