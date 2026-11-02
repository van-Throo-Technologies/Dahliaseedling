import { CAPTURE_LIMITS, ALLOWED_MIME_TYPES, maxBytesFor, extensionForMime } from "./limits";

/*
 * Pure validation for capture input. Limits come from limits.ts. The database repeats them.
 */

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, string>> };

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
export function fileProblem(file: FileDescriptor): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "That file type is not supported. Use a photo (JPEG, PNG, WebP, HEIC) or a short video (MP4, MOV, WebM).";
  }
  const limit = maxBytesFor(file.type);
  if (limit !== null && file.size > limit) {
    const megabytes = Math.round(limit / (1024 * 1024));
    return `Choose a file of ${megabytes} MB or smaller.`;
  }
  if (file.size <= 0) return "That file is empty.";
  return null;
}

/** Checks a selection before upload. Returns one message per problem, in the order the files were chosen. */
export function validateSelection(
  files: readonly FileDescriptor[],
): ValidationResult<readonly FileDescriptor[]> {
  if (files.length === 0)
    return { ok: false, fieldErrors: { files: "Choose a photo or a short video first." } };
  if (files.length > CAPTURE_LIMITS.maxFilesPerCapture) {
    return {
      ok: false,
      fieldErrors: {
        files: `Choose up to ${CAPTURE_LIMITS.maxFilesPerCapture} files for one capture.`,
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
    return { ok: false, fieldErrors: { files: "The upload is incomplete. Try again." } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, fieldErrors: { files: "The upload is incomplete. Try again." } };
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 1 ||
    parsed.length > CAPTURE_LIMITS.maxFilesPerCapture
  ) {
    return {
      ok: false,
      fieldErrors: {
        files: `Choose up to ${CAPTURE_LIMITS.maxFilesPerCapture} files for one capture.`,
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
        fieldErrors: { files: "One of the uploads does not belong to you. Start again." },
      };
    }
    paths.push(item);
  }
  if (new Set(paths).size !== paths.length) {
    return { ok: false, fieldErrors: { files: "The same file was listed twice." } };
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
      fieldErrors: { note: `Use ${CAPTURE_LIMITS.noteMaxLength} characters or fewer.` },
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
    return { ok: false, fieldErrors: { observedAt: "Enter a valid date and time." } };
  }
  const latest = now.getTime() + CAPTURE_LIMITS.futureSkewMinutes * 60 * 1000;
  if (date.getTime() > latest) {
    return { ok: false, fieldErrors: { observedAt: "The observed time cannot be in the future." } };
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
      return { ok: false, fieldErrors: { seedlingId: "Choose one of your seedlings." } };
    }
    return { ok: true, value: { mode: "existing", seedlingId } };
  }
  if (mode === "identifier") {
    const value = typeof identifier === "string" ? identifier.trim().replace(/^#/, "") : "";
    if (value === "" || value.length > 40) {
      return {
        ok: false,
        fieldErrors: { identifier: "Enter the seedling's identifier, such as JV-26-001 or #12." },
      };
    }
    return { ok: true, value: { mode: "identifier", identifier: value } };
  }
  return { ok: false, fieldErrors: { seedlingId: "Choose where this capture goes." } };
}
