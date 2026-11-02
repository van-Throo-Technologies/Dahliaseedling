import type { MessageKey, Values } from "./translator";

/**
 * Maps the sentences the database functions raise to message keys, so no English from the database reaches a
 * page. A sentence not listed here becomes the generic error. The database keeps its own wording unchanged.
 */

export interface MappedError {
  readonly key: MessageKey;
  readonly values?: Values;
}

const EXACT: ReadonlyArray<readonly [string, MessageKey, Values?]> = [
  ["seedling not found", "errors.seedling.notFound"],
  ["observation not found", "errors.capture.notFound"],
  ["that series is not available to you", "errors.db.seriesNotAvailable"],
  ["parent seedling not found", "errors.db.parentNotFound"],
  ["the same file was listed twice", "validation.capture.duplicate"],
  ["the observed time cannot be in the future", "validation.capture.timeFuture"],
  ["that file type is not supported", "errors.capture.fileNotSupported"],
  ["that file is larger than the limit for its type", "errors.db.fileTooLarge"],
  ["that upload could not be found", "errors.db.uploadNotFound"],
  ["that upload belongs to another grower", "errors.db.uploadNotYours"],
  ["sign in to create a seedling", "errors.db.signIn"],
  ["sign in to capture", "errors.db.signIn"],
  ["sign in to create a series", "errors.db.signIn"],
  ["sign in to move an observation", "errors.db.signIn"],
  ["sign in to delete an observation", "errors.db.signIn"],
  ["sign in to change parentage", "errors.db.signIn"],
  ["sign in to change identifiers", "errors.db.signIn"],
  ["create your profile before creating a seedling", "errors.db.createProfile"],
  ["suspended accounts cannot capture", "errors.capture.suspended"],
  ["suspended accounts cannot move observations", "errors.db.suspended"],
  ["suspended accounts cannot delete observations", "errors.db.suspended"],
  ["suspended accounts cannot create seedlings", "errors.db.suspended"],
  ["suspended accounts cannot create series", "errors.db.suspended"],
  ["suspended accounts cannot change parentage", "errors.db.suspended"],
  ["suspended accounts cannot change identifiers", "errors.db.suspended"],
  ["use 1 to 8 letters or digits for a series name", "validation.series.format"],
  ["notes are 2000 characters or fewer", "validation.capture.note", { max: 2000 }],
  ["choose between 1 and 6 files for one capture", "validation.capture.tooMany", { max: 6 }],
];

/** Translates a database sentence into a known key, with its numbers and names, or returns null. */
export function mapDatabaseMessage(text: string | undefined): MappedError | null {
  if (!text) return null;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  for (const [sentence, key, values] of EXACT) {
    if (lower === sentence) return values ? { key, values } : { key };
  }
  if (/^this seedling already has an identifier from series /.test(lower)) {
    return { key: "errors.seedling.duplicateSeriesIdentifier" };
  }
  const year = /^enter a first grown year to use series (.+?)\.?$/i.exec(trimmed);
  if (year?.[1]) return { key: "errors.seedling.yearNeeded", values: { name: year[1] } };
  const cultivar = /^cultivar names are (\d+) to (\d+) characters/.exec(lower);
  if (cultivar?.[1] && cultivar[2]) {
    return { key: "validation.seedling.cultivar", values: { min: cultivar[1], max: cultivar[2] } };
  }
  return null;
}
