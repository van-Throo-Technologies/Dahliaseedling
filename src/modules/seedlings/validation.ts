import { msg, type Msg } from "@/i18n/message";
import { cultivarNameMax, cultivarNameMin } from "./cultivar-limits";

/*
 * Pure validation for Seedling-core input. The same rules are enforced as database constraints and
 * inside the domain functions, so a bypassed form still cannot store bad data. This layer exists for
 * clear, field-level feedback. Messages are keys, translated at the edge.
 */

export const SEEDLING_LIMITS = {
  workingNameMax: 80,
  seriesNameMax: 8,
  cultivarNameMin: cultivarNameMin,
  cultivarNameMax: cultivarNameMax,
  notesMax: 280,
  firstGrownYearMin: 1900,
  firstGrownYearMax: 2100,
} as const;

export const VISIBILITIES = ["private", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const PARENT_ROLES = ["seed_parent", "pollen_parent"] as const;
export type ParentRole = (typeof PARENT_ROLES)[number];

export const PARENT_KINDS = ["none", "unknown", "seedling", "cultivar"] as const;
export type ParentKind = (typeof PARENT_KINDS)[number];

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, Msg>> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function text(raw: FormDataEntryValue | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function fail(field: string, message: Msg): { ok: false; fieldErrors: Record<string, Msg> } {
  return { ok: false, fieldErrors: { [field]: message } };
}

/** Series names are upper-case letters or digits, one to eight characters: JV, VT, IB. */
export function normalizeSeriesName(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateSeriesName(raw: FormDataEntryValue | null): ValidationResult<string> {
  const name = normalizeSeriesName(text(raw));
  if (name === "") return fail("name", msg("validation.series.required"));
  if (!/^[A-Z0-9]{1,8}$/.test(name)) {
    return fail("name", msg("validation.series.format"));
  }
  return { ok: true, value: name };
}

export function validateWorkingName(
  raw: FormDataEntryValue | null,
): ValidationResult<string | null> {
  const name = text(raw);
  if (name.length > SEEDLING_LIMITS.workingNameMax) {
    return fail(
      "workingName",
      msg("validation.seedling.workingName", { max: SEEDLING_LIMITS.workingNameMax }),
    );
  }
  return { ok: true, value: name === "" ? null : name };
}

export function validateFirstGrownYear(
  raw: FormDataEntryValue | null,
): ValidationResult<number | null> {
  const value = text(raw);
  if (value === "") return { ok: true, value: null };
  const year = Number(value);
  if (
    !Number.isInteger(year) ||
    year < SEEDLING_LIMITS.firstGrownYearMin ||
    year > SEEDLING_LIMITS.firstGrownYearMax
  ) {
    return fail(
      "firstGrownYear",
      msg("validation.seedling.year", {
        min: SEEDLING_LIMITS.firstGrownYearMin,
        max: SEEDLING_LIMITS.firstGrownYearMax,
      }),
    );
  }
  return { ok: true, value: year };
}

export function validateVisibility(raw: FormDataEntryValue | null): ValidationResult<Visibility> {
  const value = text(raw);
  const match = VISIBILITIES.find((visibility) => visibility === value);
  if (!match) return fail("visibility", msg("validation.seedling.visibility"));
  return { ok: true, value: match };
}

/** An empty value means "no Series": the seedling gets only its automatic number. */
export function validateSeriesChoice(
  raw: FormDataEntryValue | null,
): ValidationResult<string | null> {
  const value = text(raw);
  if (value === "") return { ok: true, value: null };
  if (!isUuid(value)) return fail("series", msg("validation.series.choose"));
  return { ok: true, value };
}

export function validateCultivarName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (
    name.length < SEEDLING_LIMITS.cultivarNameMin ||
    name.length > SEEDLING_LIMITS.cultivarNameMax
  ) {
    return null;
  }
  return name;
}

export interface ParentInput {
  readonly role: ParentRole;
  readonly kind: ParentKind;
  readonly parentSeedlingId: string | null;
  readonly cultivarName: string;
  readonly notes: string | null;
}

export function validateParentInput(form: FormData): ValidationResult<ParentInput> {
  const roleRaw = text(form.get("role"));
  const role = PARENT_ROLES.find((candidate) => candidate === roleRaw);
  if (!role) return fail("role", msg("validation.seedling.role"));

  const kindRaw = text(form.get("kind"));
  const kind = PARENT_KINDS.find((candidate) => candidate === kindRaw);
  if (!kind) return fail("kind", msg("validation.seedling.kind"));

  const parentSeedling = text(form.get("parentSeedlingId"));
  if (kind === "seedling" && !isUuid(parentSeedling)) {
    return fail("parentSeedlingId", msg("validation.seedling.parentChoose"));
  }

  const cultivarRaw = text(form.get("cultivarName"));
  if (kind === "cultivar" && validateCultivarName(cultivarRaw) === null) {
    return fail(
      "cultivarName",
      msg("validation.seedling.cultivar", {
        min: SEEDLING_LIMITS.cultivarNameMin,
        max: SEEDLING_LIMITS.cultivarNameMax,
      }),
    );
  }

  const notes = text(form.get("notes"));
  if (notes.length > SEEDLING_LIMITS.notesMax) {
    return fail("notes", msg("validation.seedling.notes", { max: SEEDLING_LIMITS.notesMax }));
  }

  return {
    ok: true,
    value: {
      role,
      kind,
      parentSeedlingId: kind === "seedling" ? parentSeedling : null,
      cultivarName: kind === "cultivar" ? cultivarRaw : "",
      notes: notes === "" ? null : notes,
    },
  };
}
