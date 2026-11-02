import { msg, type Msg } from "@/i18n/message";
import { isUuid } from "@/modules/capture/validation";
import { PUBLISH_LIMITS } from "./limits";

/*
 * Input checks for publication and social actions. The domain functions check again, so these only
 * give clear messages. They never decide what is allowed. Messages are keys, translated where they are shown.
 */

export type Checked<T> = { ok: true; value: T } | { ok: false; message: Msg };

export function validateCaption(raw: unknown): Checked<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string")
    return { ok: false, message: msg("validation.publication.captionRead") };
  const value = raw.trim();
  if (value.length > PUBLISH_LIMITS.captionMaxLength) {
    return {
      ok: false,
      message: msg("validation.publication.captionMax", { max: PUBLISH_LIMITS.captionMaxLength }),
    };
  }
  return { ok: true, value: value.length > 0 ? value : null };
}

export function validateCommentBody(raw: unknown): Checked<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length === 0) return { ok: false, message: msg("validation.publication.commentEmpty") };
  if (value.length > PUBLISH_LIMITS.commentMaxLength) {
    return {
      ok: false,
      message: msg("validation.publication.commentMax", { max: PUBLISH_LIMITS.commentMaxLength }),
    };
  }
  return { ok: true, value };
}

/** Selected media ids: one to six, each a distinct uuid. */
export function validateSelection(raw: readonly FormDataEntryValue[]): Checked<string[]> {
  const ids = raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (ids.length === 0) return { ok: false, message: msg("validation.publication.chooseImage") };
  if (ids.length > PUBLISH_LIMITS.maxItems) {
    return {
      ok: false,
      message: msg("validation.publication.chooseMax", { max: PUBLISH_LIMITS.maxItems }),
    };
  }
  if (!ids.every(isUuid) || new Set(ids).size !== ids.length) {
    return { ok: false, message: msg("validation.publication.selection") };
  }
  return { ok: true, value: ids };
}

export function validateFeedCursor(
  raw: string | undefined,
): Checked<{ publishedAt: string; id: string } | null> {
  if (!raw) return { ok: true, value: null };
  const decoded = decodeCursor(raw);
  if (!decoded || !isUuid(decoded.id) || Number.isNaN(Date.parse(decoded.publishedAt))) {
    return { ok: false, message: msg("validation.publication.cursor") };
  }
  return { ok: true, value: decoded };
}

/** A cursor is base64url of "<published_at ISO>|<update id>". It is opaque to the browser. */
export function encodeCursor(publishedAt: string, id: string): string {
  return Buffer.from(`${publishedAt}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(raw: string): { publishedAt: string; id: string } | null {
  const text = Buffer.from(raw, "base64url").toString("utf8");
  const bar = text.indexOf("|");
  if (bar < 0) return null;
  return { publishedAt: text.slice(0, bar), id: text.slice(bar + 1) };
}
