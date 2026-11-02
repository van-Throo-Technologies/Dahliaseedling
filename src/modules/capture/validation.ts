import { msg, type Msg } from "@/i18n/message";
import { CAPTURE_LIMITS, ALLOWED_MIME_TYPES, maxBytesFor, extensionForMime } from "./limits";

/*
 * Pure validation for capture input. Limits come from limits.ts. The database repeats them.
 * Messages are keys, translated where they are shown (on the page, or in the action that returns them).
 */

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, Msg>> };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface FileDescriptor {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

/** Describes why one file cannot be captured, or returns null if it can. */
export function fileProblem(file: FileDescriptor): Msg | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return msg("validation.capture.fileType");
  }
  const limit = maxBytesFor(file.type);
  if (limit !== null && file.size > limit) {
    const megabytes = Math.round(limit / (1024 * 1024));
    return msg("validation.capture.fileSize", { megabytes });
  }
  if (file.size <= 0) return msg("validation.capture.fileEmpty");
  return null;
}

/** Checks a selection before upload. Returns one message per problem, in the order the files were chosen. */
export function validateSelection(
  files: readonly FileDescriptor[],
): ValidationResult<readonly FileDescriptor[]> {
  if (files.length === 0)
    return { ok: false, fieldErrors: { files: msg("validation.capture.chooseFirst") } };
  if (files.length > CAPTURE_LIMITS.maxFilesPerCapture) {
    return {
      ok: false,
      fieldErrors: {
        files: msg("validation.capture.tooMany", { max: CAPTURE_LIMITS.maxFilesPerCapture }),
      },
    };
  }
  for (const file of files) {
    const problem = fileProblem(file);
    if (problem) return { ok: false, fieldErrors: { files: problem } };
  }
  return { ok: true, value: files };
}

/** Upload paths are {owner}/{uuid}.{ext}. Only the owner folder matching the signed-in grower is accepted. */
export function validateUploadPaths(raw: unknown, ownerId: string): ValidationResult<string[]> {
  if (typeof raw !== "string")
    return { ok: false, fieldErrors: { files: msg("validation.capture.incomplete") } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, fieldErrors: { files: msg("validation.capture.incomplete") } };
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 1 ||
    parsed.length > CAPTURE_LIMITS.maxFilesPerCapture
  ) {
    return {
      ok: false,
      fieldErrors: {
        files: msg("validation.capture.tooMany", { max: CAPTURE_LIMITS.maxFilesPerCapture }),
      },
    };
  }
  const paths: string[] = [];
  const pattern = new RegExp(
    `^${ownerId}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|heif|mp4|mov|webm)$`,
    "i",
  );
  for (const item of parsed) {
    if (typeof item !== "string" || !pattern.test(item)) {
      return {
        ok: false,
        fieldErrors: { files: msg("validation.capture.notYours") },
      };
    }
    paths.push(item);
  }
  if (new Set(paths).size !== paths.length) {
    return { ok: false, fieldErrors: { files: msg("validation.capture.duplicate") } };
  }
  return { ok: true, value: paths };
}

export function buildUploadPath(ownerId: string, mime: string, uuid: string): string | null {
  const extension = extensionForMime(mime);
  if (!extension || !isUuid(ownerId) || !isUuid(uuid)) return null;
  return `${ownerId}/${uuid}.${extension}`;
}

export function validateNote(raw: unknown): ValidationResult<string | null> {
  const note = typeof raw === "string" ? raw.trim() : "";
  if (note.length > CAPTURE_LIMITS.noteMaxLength) {
    return {
      ok: false,
      fieldErrors: { note: msg("validation.capture.note", { max: CAPTURE_LIMITS.noteMaxLength }) },
    };
  }
  return { ok: true, value: note === "" ? null : note };
}

/** Observed time comes from a datetime-local field, read as local time, and is stored as UTC. */
export function validateObservedAt(
  raw: unknown,
  now: Date = new Date(),
): ValidationResult<string | null> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return { ok: true, value: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, fieldErrors: { observedAt: msg("validation.capture.timeInvalid") } };
  }
  const latest = now.getTime() + CAPTURE_LIMITS.futureSkewMinutes * 60 * 1000;
  if (date.getTime() > latest) {
    return { ok: false, fieldErrors: { observedAt: msg("validation.capture.timeFuture") } };
  }
  return { ok: true, value: date.toISOString() };
}

export type SeedlingChoice =
  | { readonly mode: "new" }
  | { readonly mode: "existing"; readonly seedlingId: string }
  | { readonly mode: "identifier"; readonly identifier: string };

/** Where the capture goes. The mode decides which of the other fields is used. */
export function validateSeedlingChoice(
  mode: unknown,
  seedlingId: unknown,
  identifier: unknown,
): ValidationResult<SeedlingChoice> {
  if (mode === "new") return { ok: true, value: { mode: "new" } };
  if (mode === "existing") {
    if (typeof seedlingId !== "string" || !isUuid(seedlingId)) {
      return { ok: false, fieldErrors: { seedlingId: msg("validation.capture.chooseSeedling") } };
    }
    return { ok: true, value: { mode: "existing", seedlingId } };
  }
  if (mode === "identifier") {
    const value = typeof identifier === "string" ? identifier.trim().replace(/^#/, "") : "";
    if (value === "" || value.length > 40) {
      return {
        ok: false,
        fieldErrors: { identifier: msg("validation.capture.identifier") },
      };
    }
    return { ok: true, value: { mode: "identifier", identifier: value } };
  }
  return { ok: false, fieldErrors: { seedlingId: msg("validation.capture.destination") } };
}
