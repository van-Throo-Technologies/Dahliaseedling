"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import { translateFields, type Msg } from "@/i18n/message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/identity/form-state";
import { requireParticipant } from "@/modules/identity/gate";
import { resolveOwnIdentifier } from "@/modules/seedlings/repository";
import { CAPTURE_LIMITS, ALLOWED_MIME_TYPES } from "./limits";
import {
  captureObservation,
  CaptureError,
  deleteObservation,
  discardUploads,
  moveObservation,
  updateObservationText,
} from "./repository";
import {
  buildUploadPath,
  isUuid,
  validateNote,
  validateObservedAt,
  validateSeedlingChoice,
  validateUploadPaths,
  type SeedlingChoice,
} from "./validation";
import type { MessageKey } from "@/i18n/translator";

/*
 * Capture server actions. The participation gate runs first (signed in, profile, not suspended). Input is
 * validated here. Identity comes from the verified session. The database enforces ownership, the
 * seedling's holder, the media limits and the single-transaction capture.
 *
 * Failure messages never say whether a seedling exists that the grower cannot use.
 * Messages are translated here, in the visitor's language.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function failure(
  message: string,
  fieldErrors: Record<string, string> = {},
): Promise<FormState> {
  return { status: "error", fieldErrors, message };
}

async function failureKey(
  key: MessageKey,
  fieldErrors: Record<string, string> = {},
): Promise<FormState> {
  const { t } = await getTranslation();
  return failure(t(key), fieldErrors);
}

async function invalid(fields: Readonly<Record<string, Msg>>): Promise<FormState> {
  const { t } = await getTranslation();
  const first = Object.values(fields)[0];
  return failure(
    first ? t(first.key, first.values) : t("errors.checkFields"),
    translateFields(t, fields),
  );
}

/** Turns a failure from this module into the sentence the grower sees, without revealing private detail. */
async function captureMessage(error: unknown, fallback: MessageKey): Promise<string> {
  const { t } = await getTranslation();
  if (error instanceof CaptureError) return t(error.key, error.values);
  return t(fallback);
}

/** Issues upload paths for files the grower is about to send. The paths are built here, never by the browser. */
export async function prepareUploadsAction(
  mimeTypes: readonly string[],
): Promise<{ readonly paths: string[] } | { readonly error: string }> {
  const { userId } = await requireParticipant("/capture");
  const { t } = await getTranslation();

  if (mimeTypes.length < 1 || mimeTypes.length > CAPTURE_LIMITS.maxFilesPerCapture) {
    return { error: t("validation.capture.tooMany", { max: CAPTURE_LIMITS.maxFilesPerCapture }) };
  }
  const paths: string[] = [];
  for (const mime of mimeTypes) {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
      return { error: t("errors.capture.fileNotSupported") };
    }
    const path = buildUploadPath(userId, mime, crypto.randomUUID());
    if (!path) return { error: t("errors.capture.fileNotSupported") };
    paths.push(path);
  }
  return { paths };
}

/** Removes uploads the grower abandoned. Only uploads that never became media can be removed. */
export async function discardUploadsAction(paths: readonly string[]): Promise<void> {
  const { userId } = await requireParticipant("/capture");
  const own = paths.filter((path) => path.startsWith(`${userId}/`));
  const supabase = await createSupabaseServerClient();
  await discardUploads(supabase, own);
}

async function resolveChoice(
  choice: SeedlingChoice,
): Promise<{ readonly seedlingId: string | null; readonly newSeedling: boolean } | null> {
  if (choice.mode === "new") return { seedlingId: null, newSeedling: true };
  if (choice.mode === "existing") return { seedlingId: choice.seedlingId, newSeedling: false };
  const supabase = await createSupabaseServerClient();
  const found = await resolveOwnIdentifier(supabase, choice.identifier);
  if (!found) return null;
  return { seedlingId: found, newSeedling: false };
}

export async function captureAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireParticipant("/capture");

  const choice = validateSeedlingChoice(
    text(formData, "mode"),
    text(formData, "seedlingId"),
    text(formData, "identifier"),
  );
  const note = validateNote(text(formData, "note"));
  const voice = validateNote(text(formData, "voiceTranscript"));
  const observedAt = validateObservedAt(text(formData, "observedAt"));
  const paths = validateUploadPaths(text(formData, "paths"), userId);

  const fieldErrors: Record<string, Msg> = {};
  if (!choice.ok) Object.assign(fieldErrors, choice.fieldErrors);
  if (!note.ok) Object.assign(fieldErrors, note.fieldErrors);
  if (!voice.ok) Object.assign(fieldErrors, voice.fieldErrors);
  if (!observedAt.ok) Object.assign(fieldErrors, observedAt.fieldErrors);
  if (!paths.ok) Object.assign(fieldErrors, paths.fieldErrors);
  if (!choice.ok || !note.ok || !voice.ok || !observedAt.ok || !paths.ok) {
    return invalid(fieldErrors);
  }

  const target = await resolveChoice(choice.value);
  if (!target) {
    return failureKey("errors.capture.seedlingUnavailable", {
      identifier: (await getTranslation()).t("errors.capture.seedlingUnavailable"),
    });
  }

  const supabase = await createSupabaseServerClient();
  let saved;
  try {
    saved = await captureObservation(supabase, {
      seedlingId: target.seedlingId,
      newSeedling: target.newSeedling,
      observedAt: observedAt.value,
      note: note.value,
      voiceTranscript: voice.value,
      paths: paths.value,
    });
  } catch (error) {
    return failure(await captureMessage(error, "errors.capture.captureFailed"));
  }

  revalidatePath("/profile");
  revalidatePath(`/seedlings/${saved.seedlingId}`);
  redirect(`/observations/${saved.id}?saved=1`);
}

export async function updateObservationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "observationId");
  if (!isUuid(id)) return failureKey("errors.capture.notFound");
  await requireParticipant(`/observations/${id}`);

  const note = validateNote(text(formData, "note"));
  const observedAt = validateObservedAt(text(formData, "observedAt"));
  if (!note.ok || !observedAt.ok) {
    const { t } = await getTranslation();
    return failure(
      t("errors.checkFields"),
      translateFields(t, {
        ...(note.ok ? {} : note.fieldErrors),
        ...(observedAt.ok ? {} : observedAt.fieldErrors),
      }),
    );
  }

  const supabase = await createSupabaseServerClient();
  try {
    const updated = await updateObservationText(supabase, id, {
      note: note.value,
      observedAt: observedAt.value,
    });
    if (!updated) return failureKey("errors.capture.notAuthor");
  } catch {
    return failureKey("errors.capture.notSaved");
  }
  revalidatePath(`/observations/${id}`);
  const { t } = await getTranslation();
  return { status: "saved", message: t("capture.observation.savedPrivately") };
}

export async function moveObservationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "observationId");
  if (!isUuid(id)) return failureKey("errors.capture.notFound");
  await requireParticipant(`/observations/${id}/move`);

  const choice = validateSeedlingChoice(
    text(formData, "mode"),
    text(formData, "seedlingId"),
    text(formData, "identifier"),
  );
  if (!choice.ok) return invalid(choice.fieldErrors);

  const target = await resolveChoice(choice.value);
  if (!target) {
    const { t } = await getTranslation();
    return failure(t("errors.capture.seedlingUnavailable"), {
      identifier: t("errors.capture.seedlingUnavailable"),
    });
  }

  const supabase = await createSupabaseServerClient();
  let moved;
  try {
    moved = await moveObservation(supabase, id, target);
  } catch (error) {
    return failure(await captureMessage(error, "errors.capture.notMoved"));
  }

  revalidatePath(`/seedlings/${moved.seedlingId}`);
  revalidatePath(`/observations/${id}`);
  redirect(`/observations/${id}?moved=1`);
}

export async function deleteObservationAction(formData: FormData): Promise<void> {
  const id = text(formData, "observationId");
  if (!isUuid(id)) redirect("/profile");
  await requireParticipant(`/observations/${id}`);

  const supabase = await createSupabaseServerClient();
  try {
    await deleteObservation(supabase, id);
  } catch {
    redirect(`/observations/${id}?deleteFailed=1`);
  }
  revalidatePath("/profile");
  redirect("/profile?deleted=1");
}
