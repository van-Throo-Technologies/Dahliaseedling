"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import { msg, translateFields, type Msg } from "@/i18n/message";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/identity/form-state";
import { requireParticipant } from "@/modules/identity/gate";
import { recordUnidentifiedParent } from "@/modules/seeds/parentage";
import { SeedFailure } from "@/modules/seeds/photos";
import { labelWords } from "./labels";
import {
  attachSeriesRecord,
  createSeedlingRecord,
  createSeriesRecord,
  findParentCandidates,
  SeedlingError,
  setParentRecord,
  updateSeedlingCore,
  type ParentCandidate,
} from "./repository";
import {
  isUuid,
  validateFirstGrownYear,
  validateParentInput,
  validateSeriesChoice,
  validateSeriesName,
  validateVisibility,
  validateWorkingName,
} from "./validation";
import { refuseOnPublicSurface } from "@/lib/security/public-action-guard";

/*
 * Server actions for Seedling core. Each one:
 *   1. passes the participation gate (signed in, profile present, not suspended),
 *   2. validates input on the server,
 *   3. calls the database through the signed-in user's session.
 * The database decides ownership, visibility and sequencing, so a bypassed form cannot do more.
 * Messages are translated here, in the visitor's language, before they reach the form.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function invalid(
  fieldErrors: Readonly<Record<string, Msg>>,
  values: Record<string, string> = {},
): Promise<FormState> {
  const { t } = await getTranslation();
  return {
    status: "error",
    fieldErrors: translateFields(t, fieldErrors),
    message: t("errors.checkFields"),
    values,
  };
}

async function failure(message: string): Promise<FormState> {
  return { status: "error", fieldErrors: {}, message };
}

/** The sentence for a failure this module raised: its key translated, or the generic message. */
async function failed(error: unknown, generic: MessageKey): Promise<FormState> {
  const { t } = await getTranslation();
  if (error instanceof SeedlingError) return failure(t(error.key, error.values));
  return failure(t(generic));
}

export async function createSeriesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  await requireParticipant("/series");
  const { t } = await getTranslation();

  const name = validateSeriesName(formData.get("name"));
  if (!name.ok) return invalid(name.fieldErrors, { name: text(formData, "name") });

  const includeYear = formData.get("includeYear") === "on";
  const supabase = await createSupabaseServerClient();
  try {
    const series = await createSeriesRecord(supabase, name.value, includeYear);
    revalidatePath("/series");
    const yy = String(new Date().getUTCFullYear() % 100).padStart(2, "0");
    const example = series.pattern.replace("{YY}", yy).replace("{NNN}", "001");
    return {
      status: "saved",
      message: t("seedlings.series.created", { name: series.name, example }),
    };
  } catch (error) {
    return failed(error, "errors.unexpected");
  }
}

export async function createSeedlingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  await requireParticipant("/seedlings/new");

  const series = validateSeriesChoice(formData.get("seriesId"));
  const workingName = validateWorkingName(formData.get("workingName"));
  const year = validateFirstGrownYear(formData.get("firstGrownYear"));
  const visibility = validateVisibility(formData.get("visibility"));
  if (!series.ok || !workingName.ok || !year.ok || !visibility.ok) {
    return invalid(
      {
        ...(series.ok ? {} : series.fieldErrors),
        ...(workingName.ok ? {} : workingName.fieldErrors),
        ...(year.ok ? {} : year.fieldErrors),
        ...(visibility.ok ? {} : visibility.fieldErrors),
      },
      {
        workingName: text(formData, "workingName"),
        firstGrownYear: text(formData, "firstGrownYear"),
      },
    );
  }

  const supabase = await createSupabaseServerClient();
  let created;
  try {
    created = await createSeedlingRecord(supabase, {
      seriesId: series.value,
      workingName: workingName.value,
      firstGrownYear: year.value,
      visibility: visibility.value,
    });
  } catch (error) {
    // A year-based series needs the year. Say so on the year field, and keep what the user typed.
    if (error instanceof SeedlingError && error.key === "errors.seedling.yearNeeded") {
      const { t } = await getTranslation();
      return {
        status: "error",
        fieldErrors: { firstGrownYear: t(error.key, error.values) },
        message: t("errors.checkFields"),
        values: {
          workingName: workingName.value ?? "",
          firstGrownYear: text(formData, "firstGrownYear"),
        },
      };
    }
    return failed(error, "errors.seedling.seedlingFailed");
  }

  revalidatePath("/profile");
  redirect(`/seedlings/${created.id}`);
}

export async function updateSeedlingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  const { t } = await getTranslation();
  const id = text(formData, "seedlingId");
  if (!isUuid(id)) return failure(t("errors.seedling.notFound"));
  await requireParticipant(`/seedlings/${id}`);

  const workingName = validateWorkingName(formData.get("workingName"));
  const year = validateFirstGrownYear(formData.get("firstGrownYear"));
  const visibility = validateVisibility(formData.get("visibility"));
  if (!workingName.ok || !year.ok || !visibility.ok) {
    return invalid({
      ...(workingName.ok ? {} : workingName.fieldErrors),
      ...(year.ok ? {} : year.fieldErrors),
      ...(visibility.ok ? {} : visibility.fieldErrors),
    });
  }

  const supabase = await createSupabaseServerClient();
  try {
    const updated = await updateSeedlingCore(supabase, id, {
      workingName: workingName.value,
      firstGrownYear: year.value,
      visibility: visibility.value,
    });
    if (!updated) return failure(t("errors.seedling.notHolder"));
  } catch (error) {
    return failed(error, "errors.seedling.changesFailed");
  }

  revalidatePath(`/seedlings/${id}`);
  revalidatePath("/profile");
  // Identifiers that already exist keep their values. Changing the year does not rename them.
  return { status: "saved", message: t("seedlings.edit.saved") };
}

export async function attachSeriesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  const { t } = await getTranslation();
  const id = text(formData, "seedlingId");
  if (!isUuid(id)) return failure(t("errors.seedling.notFound"));
  await requireParticipant(`/seedlings/${id}`);

  const series = validateSeriesChoice(formData.get("seriesId"));
  if (!series.ok || series.value === null) {
    return invalid({ seriesId: msg("validation.series.choose") });
  }

  const supabase = await createSupabaseServerClient();
  try {
    await attachSeriesRecord(supabase, id, series.value);
  } catch (error) {
    if (error instanceof SeedlingError && error.key === "errors.seedling.yearNeeded") {
      return {
        status: "error",
        fieldErrors: { seriesId: t(error.key, error.values) },
        message: t("errors.checkFields"),
      };
    }
    return failed(error, "errors.seedling.identifierFailed");
  }

  revalidatePath(`/seedlings/${id}`);
  revalidatePath("/profile");
  return { status: "saved", message: t("seedlings.attach.saved") };
}

export async function setParentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  refuseOnPublicSurface();
  const { t } = await getTranslation();
  const id = text(formData, "seedlingId");
  if (!isUuid(id)) return failure(t("errors.seedling.notFound"));
  const { userId } = await requireParticipant(`/seedlings/${id}`);

  const parent = validateParentInput(formData);
  if (!parent.ok) return invalid(parent.fieldErrors);

  const supabase = await createSupabaseServerClient();
  try {
    if (parent.value.kind === "unidentified") {
      const photo = formData.get("sourcePhoto");
      await recordUnidentifiedParent(
        supabase,
        userId,
        id,
        parent.value.role,
        parent.value,
        photo instanceof File && photo.size > 0 ? photo : null,
      );
    } else {
      await setParentRecord(supabase, id, parent.value);
    }
  } catch (error) {
    if (error instanceof SeedFailure) return failure(t(error.key as MessageKey));
    return failed(error, "errors.seedling.parentageFailed");
  }

  revalidatePath(`/seedlings/${id}`);
  return { status: "saved", message: t("seedlings.parent.saved") };
}

/**
 * Lets the parent selector find seedlings the signed-in grower may choose. Results are limited by RLS:
 * a private seedling of someone else is never returned.
 */
export async function findParentCandidatesAction(
  term: string,
  seedlingId: string,
): Promise<ParentCandidate[]> {
  refuseOnPublicSurface();
  if (!isUuid(seedlingId)) return [];
  const { userId } = await requireParticipant(`/seedlings/${seedlingId}`);
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  return findParentCandidates(supabase, {
    term,
    excludeSeedlingId: seedlingId,
    readerId: userId,
    words: labelWords(t),
  });
}
