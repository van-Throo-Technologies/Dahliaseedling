/*
 * Capture limits, in one place. Enforced in two layers:
 *   - the browser checks them first, for clear feedback;
 *   - the database enforces them authoritatively (see _register_media_object and the bucket
 *     configuration in the Phase 3 migration). A bypassed form still cannot store an oversize file.
 * If a limit changes, change it here and in the migration, and the database tests will show a mismatch.
 */
export const CAPTURE_LIMITS = {
  imageMaxBytes: 15 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  /** Checked in the browser only. The server cannot read video duration without media processing. */
  videoMaxSeconds: 60,
  maxFilesPerCapture: 6,
  noteMaxLength: 2000,
  /** An observed time may be a few minutes ahead of the server clock, and no more. */
  futureSkewMinutes: 5,
} as const;

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const ALLOWED_MIME_TYPES: readonly string[] = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];

export type MediaKind = "image" | "video";

export function kindForMime(mime: string): MediaKind | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

export function maxBytesFor(mime: string): number | null {
  const kind = kindForMime(mime);
  if (kind === "image") return CAPTURE_LIMITS.imageMaxBytes;
  if (kind === "video") return CAPTURE_LIMITS.videoMaxBytes;
  return null;
}

/** File extension stored with each original. The storage path is only a name: access is never granted by it. */
export function extensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    case "video/webm":
      return "webm";
    default:
      return null;
  }
}
