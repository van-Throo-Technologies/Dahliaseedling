"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

/*
 * Capture server actions. The participation gate runs first (signed in, profile, not suspended). Input is
 * validated here. Identity comes from the verified session. The database enforces ownership, the
 * seedling's holder, the media limits and the single-transaction capture.
 *
 * Failure messages never say whether a seedling exists that the grower cannot use.
 */

const NOT_AVAILABLE =
  "That seedling is not available to you. Check the identifier, or choose one from your list.";
const CHECK_FIELDS = "Check the highlighted fields.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failure(message: string, fieldErrors: Record<string, string> = {}): FormState {
  return { status: "error", fieldErrors, message };
}

/** Turns a database failure into a message the grower can act on, without revealing private detail. */
function captureMessage(error: unknown, fallback: string): string {
  const message = error instanceof CaptureError ? error.message : "";
  if (message.includes("seedling not found")) return NOT_AVAILABLE;
  if (message.includes("upload could not be found"))
    return "An upload did not finish. Try the photo again.";
  if (
    message.includes("not supported") ||
    message.includes("larger than") ||
    message.includes("1 and 6")
  )
    return message;
  if (message.includes("cannot be in the future"))
    return "The observed time cannot be in the future.";
  if (message.includes("suspended"))
    return "Your account is suspended, so you cannot capture or change observations.";
  return fallback;
}

/** Issues upload paths for files the grower is about to send. The paths are built here, never by the browser. */
export async function prepareUploadsAction(
  mimeTypes: readonly string[],
): Promise<{ readonly paths: string[] } | { readonly error: string }> {
  const { userId } = await requireParticipant("/capture");

  if (mimeTypes.length < 1 || mimeTypes.length > CAPTURE_LIMITS.maxFilesPerCapture) {
    return { error: `Choose up to ${CAPTURE_LIMITS.maxFilesPerCapture} files for one capture.` };
  }
  const paths: string[] = [];
  for (const mime of mimeTypes) {
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
      return { error: "That file type is not supported." };
    }
    const path = buildUploadPath(userId, mime, crypto.randomUUID());
    if (!path) return { error: "That file type is not supported." };
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

  const fieldErrors: Record<string, string> = {};
  if (!choice.ok) Object.assign(fieldErrors, choice.fieldErrors);
  if (!note.ok) Object.assign(fieldErrors, note.fieldErrors);
  if (!voice.ok) Object.assign(fieldErrors, voice.fieldErrors);
  if (!observedAt.ok) Object.assign(fieldErrors, observedAt.fieldErrors);
  if (!paths.ok) Object.assign(fieldErrors, paths.fieldErrors);
  if (!choice.ok || !note.ok || !voice.ok || !observedAt.ok || !paths.ok) {
    return failure(Object.values(fieldErrors)[0] ?? CHECK_FIELDS, fieldErrors);
  }

  const target = await resolveChoice(choice.value);
  if (!target) return failure(NOT_AVAILABLE, { identifier: NOT_AVAILABLE });

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
    return failure(
      captureMessage(
        error,
        "The capture could not be saved. Your files are still here, so try again.",
      ),
    );
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
  if (!isUuid(id)) return failure("That observation could not be found.");
  await requireParticipant(`/observations/${id}`);

  const note = validateNote(text(formData, "note"));
  const observedAt = validateObservedAt(text(formData, "observedAt"));
  if (!note.ok || !observedAt.ok) {
    return failure(CHECK_FIELDS, {
      ...(note.ok ? {} : note.fieldErrors),
      ...(observedAt.ok ? {} : observedAt.fieldErrors),
    });
  }

  const supabase = await createSupabaseServerClient();
  try {
    const updated = await updateObservationText(supabase, id, {
      note: note.value,
      observedAt: observedAt.value,
    });
    if (!updated) return failure("Only the author can change this observation.");
  } catch {
    return failure("The observation could not be saved. Try again.");
  }
  revalidatePath(`/observations/${id}`);
  return { status: "saved", message: "Saved privately." };
}

export async function moveObservationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "observationId");
  if (!isUuid(id)) return failure("That observation could not be found.");
  await requireParticipant(`/observations/${id}/move`);

  const choice = validateSeedlingChoice(
    text(formData, "mode"),
    text(formData, "seedlingId"),
    text(formData, "identifier"),
  );
  if (!choice.ok) return failure(CHECK_FIELDS, choice.fieldErrors);

  const target = await resolveChoice(choice.value);
  if (!target) return failure(NOT_AVAILABLE, { identifier: NOT_AVAILABLE });

  const supabase = await createSupabaseServerClient();
  let moved;
  try {
    moved = await moveObservation(supabase, id, target);
  } catch (error) {
    return failure(
      captureMessage(error, "The observation could not be moved. Nothing has changed."),
    );
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
