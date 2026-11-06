"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { msg, type Msg } from "@/i18n/message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/identity/form-state";
import { requireParticipant } from "@/modules/identity/gate";
import { getObservation, mediaFor, mediaRow } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { getSeedling } from "@/modules/seedlings/repository";
import { DerivativeError, makePublicImage } from "./derivatives";
import { isPubliclyShareable } from "./limits";
import { validateCaption, validateCommentBody, validateSelection } from "./validation";
import { refuseOnPublicSurface } from "@/lib/security/public-action-guard";

/*
 * Server actions for publication and the social layer. Each one passes the participation gate, checks its
 * input, and then calls a domain function as the signed-in grower. The database decides ownership,
 * visibility, idempotency and suspension, so a bypassed form cannot do more than the rules allow.
 * Messages are translated here, in the visitor's language.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function failureKey(key: MessageKey): Promise<FormState> {
  const { t } = await getTranslation();
  return { status: "error", fieldErrors: {}, message: t(key) };
}

async function failureMsg(message: Msg): Promise<FormState> {
  const { t } = await getTranslation();
  return { status: "error", fieldErrors: {}, message: t(message.key, message.values) };
}

/** A publication step the database or the storage layer refused, with a key safe to show. */
class PublishFailure extends Error {
  readonly key: MessageKey;

  constructor(key: MessageKey) {
    super(key);
    this.key = key;
  }
}

/** Maps a database refusal to the key the grower can act on. Database wording is never shown. */
function publicationKey(error: { code?: string }): MessageKey {
  switch (error.code) {
    case "42501":
      return "errors.publication.notHolder";
    case "P0002":
      return "errors.publication.observationNotFound";
    case "23514":
      return "errors.publication.makePublicFirst";
    case "0A000":
      return "errors.publication.videoNotAvailable";
    case "53400":
      return "safety.errors.rateLimited";
    default:
      return "errors.publication.notPublished";
  }
}

/**
 * Makes the Seedling public, as one explicit step inside the Share journey. It changes only the seedling's
 * visibility. Observations, media, notes and transcripts keep their privacy.
 */
export async function makeSeedlingPublicAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const observationId = text(formData, "observationId");
  if (!isUuid(observationId)) redirect("/capture");
  await requireParticipant(`/observations/${observationId}/share`);

  const supabase = await createSupabaseServerClient();
  const observation = await getObservation(supabase, observationId);
  if (!observation) redirect("/capture");

  const { data, error } = await supabase
    .from("seedlings")
    .update({ visibility: "public" })
    .eq("id", observation.seedlingId)
    .select("id");
  if (error || !data || data.length === 0) {
    redirect(`/observations/${observationId}/share?error=seedling`);
  }
  revalidatePath(`/seedlings/${observation.seedlingId}`);
  redirect(`/observations/${observationId}/share?public=1`);
}

type UploadedItem = {
  readonly media_id: string;
  readonly derivative_path: string;
  readonly width: number;
  readonly height: number;
  readonly byte_size: number;
};

/**
 * Publishes the selected images of one observation as one Update.
 *
 * Failure model. Derivatives are created and uploaded first, then the Update and its public references are
 * written in one database transaction. Only a successful transaction reports "Published". If anything
 * fails before it, the uploaded derivatives are removed, and nothing is referenced. A repeated submission
 * with the same client key is refused by the database and returns the Update it already made.
 */
export async function publishUpdateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  const observationId = text(formData, "observationId");
  if (!isUuid(observationId)) return failureKey("errors.publication.observationNotFound");
  const { userId } = await requireParticipant(`/observations/${observationId}/share`);

  const clientKey = text(formData, "clientKey");
  if (!isUuid(clientKey)) return failureKey("errors.publication.formExpired");

  const caption = validateCaption(formData.get("caption"));
  if (!caption.ok) return failureMsg(caption.message);
  const selection = validateSelection(formData.getAll("mediaId"));
  if (!selection.ok) return failureMsg(selection.message);

  const supabase = await createSupabaseServerClient();
  const observation = await getObservation(supabase, observationId);
  if (!observation) return failureKey("errors.publication.observationNotFound");
  const seedling = await getSeedling(supabase, observation.seedlingId);
  if (!seedling || seedling.currentHolderId !== userId)
    return failureKey("errors.publication.notHolder");
  if (seedling.visibility !== "public") return failureKey("errors.publication.makePublicFirst");

  const available = (await mediaFor(supabase, [observationId])).get(observationId) ?? [];
  const chosen = selection.value.map((id) => available.find((item) => item.id === id));
  if (chosen.some((item) => item === undefined))
    return failureMsg(msg("validation.publication.selection"));
  if (chosen.some((item) => item?.kind === "video"))
    return failureKey("errors.publication.videoNotAvailableChoose");
  if (chosen.some((item) => item && !isPubliclyShareable(item.mimeType))) {
    return failureKey("publication.publish.privateOnly");
  }

  const uploaded: string[] = [];
  let outcome: { id: string; created: boolean };
  try {
    const items: UploadedItem[] = [];
    for (const item of chosen) {
      if (!item) continue;
      const row = await mediaRow(supabase, item.id);
      if (!row) throw new PublishFailure("errors.publication.photoNotRead");

      const { data: blob, error: downloadError } = await supabase.storage
        .from("private-media")
        .download(row.storage_path);
      if (downloadError || !blob) throw new PublishFailure("errors.publication.photoNotRead");

      const image = await makePublicImage(Buffer.from(await blob.arrayBuffer()));
      const path = `${userId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from("public-media")
        .upload(path, image.data, { contentType: "image/webp", upsert: false });
      if (uploadError) throw new PublishFailure("errors.publication.photoNotUploaded");
      uploaded.push(path);

      items.push({
        media_id: item.id,
        derivative_path: path,
        width: image.width,
        height: image.height,
        byte_size: image.data.byteLength,
      });
    }

    const { data, error } = await supabase.rpc("publish_update", {
      p_observation_id: observationId,
      p_client_key: clientKey,
      p_caption: caption.value ?? undefined,
      p_items: items,
    });
    if (error) throw new PublishFailure(publicationKey(error));
    outcome = data as unknown as { id: string; created: boolean };
  } catch (error) {
    await discard(supabase, uploaded);
    if (error instanceof DerivativeError || error instanceof PublishFailure) {
      return failureKey(error.key);
    }
    return failureKey("errors.publication.nothingShared");
  }

  // A repeated submission created nothing new, so the files it uploaded are unreferenced and removed.
  if (!outcome.created) await discard(supabase, uploaded);
  revalidatePath("/");
  revalidatePath(`/seedlings/${observation.seedlingId}`);
  redirect(`/updates/${outcome.id}${outcome.created ? "?published=1" : ""}`);
}

async function discard(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  paths: readonly string[],
): Promise<void> {
  if (paths.length === 0) return;
  // Removal is best effort. A file that cannot be removed is unreferenced, so it is never shown publicly.
  await supabase.storage.from("public-media").remove([...paths]);
}

export async function deleteUpdateAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const updateId = text(formData, "updateId");
  if (!isUuid(updateId)) redirect("/");
  const { userId } = await requireParticipant(`/updates/${updateId}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_update", { p_update_id: updateId });
  if (error) redirect(`/updates/${updateId}?error=delete`);
  revalidatePath("/");
  redirect(`/profiles/${userId}?tab=updates&deleted=1`);
}

export async function setCoverAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const seedlingId = text(formData, "seedlingId");
  const derivativeId = text(formData, "derivativeId");
  if (!isUuid(seedlingId)) redirect("/");
  await requireParticipant(`/seedlings/${seedlingId}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_seedling_cover", {
    p_seedling_id: seedlingId,
    p_derivative_id: isUuid(derivativeId) ? derivativeId : undefined,
  });
  if (error) redirect(`/seedlings/${seedlingId}?error=cover`);
  revalidatePath(`/seedlings/${seedlingId}`);
  revalidatePath("/");
}

/** Adds a comment, or a reply when a parent id is given. The database checks the parent's Update. */
export async function addCommentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  const updateId = text(formData, "updateId");
  if (!isUuid(updateId)) return failureKey("errors.publication.updateNotFound");
  await requireParticipant(`/updates/${updateId}`);

  const body = validateCommentBody(formData.get("body"));
  if (!body.ok) return failureMsg(body.message);
  const parentId = text(formData, "parentId");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_comment", {
    p_update_id: updateId,
    p_parent_comment_id: isUuid(parentId) ? parentId : undefined,
    p_body: body.value,
  });
  if (error) return failureKey("errors.publication.commentFailed");
  revalidatePath(`/updates/${updateId}`);
  const { t } = await getTranslation();
  return { status: "saved", message: t("publication.comments.posted") };
}

export async function editCommentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  const updateId = text(formData, "updateId");
  const commentId = text(formData, "commentId");
  if (!isUuid(updateId) || !isUuid(commentId))
    return failureKey("errors.publication.updateNotFound");
  await requireParticipant(`/updates/${updateId}`);

  const body = validateCommentBody(formData.get("body"));
  if (!body.ok) return failureMsg(body.message);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("edit_comment", {
    p_comment_id: commentId,
    p_body: body.value,
  });
  if (error) return failureKey("errors.publication.commentChangeFailed");
  revalidatePath(`/updates/${updateId}`);
  const { t } = await getTranslation();
  return { status: "saved", message: t("publication.comments.changed") };
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const updateId = text(formData, "updateId");
  const commentId = text(formData, "commentId");
  if (!isUuid(updateId) || !isUuid(commentId)) redirect("/");
  await requireParticipant(`/updates/${updateId}`);

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("delete_comment", { p_comment_id: commentId });
  revalidatePath(`/updates/${updateId}`);
}

export async function toggleLikeAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const updateId = text(formData, "updateId");
  if (!isUuid(updateId)) redirect("/");
  await requireParticipant(`/updates/${updateId}`);

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("set_like", { p_update_id: updateId, p_on: formData.get("on") === "1" });
  revalidatePath("/");
  revalidatePath(`/updates/${updateId}`);
}

export async function toggleSeedlingFollowAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const seedlingId = text(formData, "seedlingId");
  if (!isUuid(seedlingId)) redirect("/");
  const returnTo = safeReturn(text(formData, "returnTo"), `/seedlings/${seedlingId}`);
  await requireParticipant(returnTo);

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("set_seedling_follow", {
    p_seedling_id: seedlingId,
    p_on: formData.get("on") === "1",
  });
  revalidatePath(`/seedlings/${seedlingId}`);
  revalidatePath("/");
}

export async function toggleGrowerFollowAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const profileId = text(formData, "profileId");
  if (!isUuid(profileId)) redirect("/");
  const returnTo = safeReturn(text(formData, "returnTo"), `/profiles/${profileId}`);
  await requireParticipant(returnTo);

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("set_grower_follow", {
    p_profile_id: profileId,
    p_on: formData.get("on") === "1",
  });
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/");
}

export async function toggleSavedAction(formData: FormData): Promise<void> {
  refuseOnPublicSurface();
  const seedlingId = text(formData, "seedlingId");
  if (!isUuid(seedlingId)) redirect("/");
  const returnTo = safeReturn(text(formData, "returnTo"), `/seedlings/${seedlingId}`);
  await requireParticipant(returnTo);

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("set_seedling_save", {
    p_seedling_id: seedlingId,
    p_on: formData.get("on") === "1",
  });
  revalidatePath(`/seedlings/${seedlingId}`);
}

/** Only same-site paths are accepted as a return destination, so a form cannot redirect elsewhere. */
function safeReturn(raw: string, fallback: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
