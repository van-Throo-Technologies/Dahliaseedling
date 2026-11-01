/*
 * Pure validation for Seedling-core input. The same rules are enforced as database constraints and
 * inside the domain functions, so a bypassed form still cannot store bad data. This layer exists for
 * clear, field-level feedback.
 */

export const SEEDLING_LIMITS = {
  workingNameMax: 80,
  seriesNameMax: 8,
  cultivarNameMin: 2,
  cultivarNameMax: 80,
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
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function text(raw: FormDataEntryValue | null | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function fail(field: string, message: string): { ok: false; fieldErrors: Record<string, string> } {
  return { ok: false, fieldErrors: { [field]: message } };
}

/** Series names are upper-case letters or digits, one to eight characters: JV, VT, IB. */
export function normalizeSeriesName(raw: string): string {
  return raw.trim().toUpperCase();
}

export function validateSeriesName(raw: FormDataEntryValue | null): ValidationResult<string> {
  const name = normalizeSeriesName(text(raw));
  if (name === "") return fail("name", "Enter a series name, such as JV.");
  if (!/^[A-Z0-9]{1,8}$/.test(name)) {
    return fail("name", "Use 1 to 8 letters or numbers, with no spaces or symbols.");
  }
  return { ok: true, value: name };
}

export function validateWorkingName(
  raw: FormDataEntryValue | null,
): ValidationResult<string | null> {
  const name = text(raw);
  if (name.length > SEEDLING_LIMITS.workingNameMax) {
    return fail("workingName", `Use ${SEEDLING_LIMITS.workingNameMax} characters or fewer.`);
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
      `Enter a year between ${SEEDLING_LIMITS.firstGrownYearMin} and ${SEEDLING_LIMITS.firstGrownYearMax}, or leave it empty.`,
    );
  }
  return { ok: true, value: year };
}

export function validateVisibility(raw: FormDataEntryValue | null): ValidationResult<Visibility> {
  const value = text(raw);
  const match = VISIBILITIES.find((visibility) => visibility === value);
  if (!match) return fail("visibility", "Choose private or public.");
  return { ok: true, value: match };
}

/** An empty value means "no Series": the seedling gets only its automatic number. */
export function validateSeriesChoice(
  raw: FormDataEntryValue | null,
): ValidationResult<string | null> {
  const value = text(raw);
  if (value === "") return { ok: true, value: null };
  if (!isUuid(value)) return fail("series", "Choose one of your series.");
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
  if (!role) return fail("role", "Choose seed parent or pollen parent.");

  const kindRaw = text(form.get("kind"));
  const kind = PARENT_KINDS.find((candidate) => candidate === kindRaw);
  if (!kind) return fail("kind", "Choose how this parent is known.");

  const parentSeedling = text(form.get("parentSeedlingId"));
  if (kind === "seedling" && !isUuid(parentSeedling)) {
    return fail("parentSeedlingId", "Choose one of the seedlings you can see.");
  }

  const cultivarRaw = text(form.get("cultivarName"));
  if (kind === "cultivar" && validateCultivarName(cultivarRaw) === null) {
    return fail(
      "cultivarName",
      `Enter a cultivar name of ${SEEDLING_LIMITS.cultivarNameMin} to ${SEEDLING_LIMITS.cultivarNameMax} characters.`,
    );
  }

  const notes = text(form.get("notes"));
  if (notes.length > SEEDLING_LIMITS.notesMax) {
    return fail("notes", `Use ${SEEDLING_LIMITS.notesMax} characters or fewer.`);
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
