"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/identity/form-state";
import { requireParticipant } from "@/modules/identity/gate";
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

/*
 * Server actions for Seedling core. Each one:
 *   1. passes the participation gate (signed in, profile present, not suspended),
 *   2. validates input on the server,
 *   3. calls the database through the signed-in user's session.
 * The database decides ownership, visibility and sequencing, so a bypassed form cannot do more.
 */

const CHECK_FIELDS = "Check the highlighted fields.";

function invalid(
  fieldErrors: Record<string, string>,
  values: Record<string, string> = {},
): FormState {
  return { status: "error", fieldErrors, message: CHECK_FIELDS, values };
}

function failure(message: string): FormState {
  return { status: "error", fieldErrors: {}, message };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createSeriesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireParticipant("/series");

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
      message: `Series ${series.name} is ready. Its identifiers look like ${example}.`,
    };
  } catch (error) {
    return failure(
      error instanceof SeedlingError ? error.message : "The series could not be created.",
    );
  }
}

export async function createSeedlingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
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
    const message =
      error instanceof SeedlingError ? error.message : "The seedling could not be created.";
    // A year-based series needs the year. Say so on the year field, and keep what the user typed.
    if (message.includes("first grown year")) {
      return invalid(
        { firstGrownYear: message },
        { workingName: workingName.value ?? "", firstGrownYear: text(formData, "firstGrownYear") },
      );
    }
    return failure(message);
  }

  revalidatePath("/profile");
  redirect(`/seedlings/${created.id}`);
}

export async function updateSeedlingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "seedlingId");
  if (!isUuid(id)) return failure("That seedling could not be found.");
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
    if (!updated) return failure("Only the grower who holds this seedling can change it.");
  } catch (error) {
    return failure(
      error instanceof SeedlingError ? error.message : "The changes could not be saved.",
    );
  }

  revalidatePath(`/seedlings/${id}`);
  revalidatePath("/profile");
  // Identifiers that already exist keep their values. Changing the year does not rename them.
  return {
    status: "saved",
    message: "Your changes are saved. Existing identifiers stay as they are.",
  };
}

export async function attachSeriesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "seedlingId");
  if (!isUuid(id)) return failure("That seedling could not be found.");
  await requireParticipant(`/seedlings/${id}`);

  const series = validateSeriesChoice(formData.get("seriesId"));
  if (!series.ok || series.value === null)
    return invalid({ seriesId: "Choose one of your series." });

  const supabase = await createSupabaseServerClient();
  try {
    await attachSeriesRecord(supabase, id, series.value);
  } catch (error) {
    const message =
      error instanceof SeedlingError ? error.message : "The identifier could not be added.";
    if (message.includes("first grown year")) return invalid({ seriesId: message });
    return failure(message);
  }

  revalidatePath(`/seedlings/${id}`);
  revalidatePath("/profile");
  return {
    status: "saved",
    message: "The series identifier is added. Your seedling keeps its number and its identity.",
  };
}

export async function setParentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = text(formData, "seedlingId");
  if (!isUuid(id)) return failure("That seedling could not be found.");
  await requireParticipant(`/seedlings/${id}`);

  const parent = validateParentInput(formData);
  if (!parent.ok) return invalid(parent.fieldErrors);

  const supabase = await createSupabaseServerClient();
  try {
    await setParentRecord(supabase, id, parent.value);
  } catch (error) {
    return failure(
      error instanceof SeedlingError ? error.message : "Parentage could not be saved.",
    );
  }

  revalidatePath(`/seedlings/${id}`);
  return { status: "saved", message: "Parentage is saved." };
}

/**
 * Lets the parent selector find seedlings the signed-in grower may choose. Results are limited by RLS:
 * a private seedling of someone else is never returned.
 */
export async function findParentCandidatesAction(
  term: string,
  seedlingId: string,
): Promise<ParentCandidate[]> {
  if (!isUuid(seedlingId)) return [];
  const { userId } = await requireParticipant(`/seedlings/${seedlingId}`);
  const supabase = await createSupabaseServerClient();
  return findParentCandidates(supabase, { term, excludeSeedlingId: seedlingId, readerId: userId });
}
