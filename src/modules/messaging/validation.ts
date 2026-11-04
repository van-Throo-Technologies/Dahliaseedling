/*
 * Input shaping for messages, message photographs and reports. The database repeats every rule that matters, so these checks
 * only give a clear message before the round trip. They never decide who may send or report anything.
 */

import { PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/modules/seeds/validation";

export const MESSAGE_MAX_CHARACTERS = 2000;
export const REPORT_DETAILS_MAX_CHARACTERS = 1000;
export const REPORT_REASONS = ["harassment", "spam", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_TARGETS = ["update", "comment", "profile", "message"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export type Checked<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly key: string };

/** Counts characters the way the database does, so a message the browser accepts is never refused for length. */
function characters(text: string): number {
  return [...text].length;
}

/** A message needs text, a photograph, or both. Text is trimmed; an empty text becomes null. */
export function checkMessage(raw: string, hasPhoto: boolean): Checked<string | null> {
  const body = raw.trim();
  if (body.length === 0 && !hasPhoto) return { ok: false, key: "empty" };
  if (characters(body) > MESSAGE_MAX_CHARACTERS) return { ok: false, key: "tooLong" };
  return { ok: true, value: body.length > 0 ? body : null };
}

/** A message photograph uses the same types and size as the seed photographs, which fit the request size limit. */
export function checkPhoto(file: { readonly type: string; readonly size: number }): Checked<true> {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type))
    return { ok: false, key: "photoType" };
  if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) return { ok: false, key: "photoSize" };
  return { ok: true, value: true };
}

export function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/** A report needs a reason from the fixed list; details are optional and bounded. */
export function checkReport(
  reason: string,
  details: string,
): Checked<{ reason: ReportReason; details: string | null }> {
  if (!isReportReason(reason)) return { ok: false, key: "reason" };
  const text = details.trim();
  if (characters(text) > REPORT_DETAILS_MAX_CHARACTERS) return { ok: false, key: "details" };
  return { ok: true, value: { reason, details: text.length > 0 ? text : null } };
}

/** A return path inside this app, so a form can send the grower back where they were and never to another site. */
export function safeReturnPath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}
