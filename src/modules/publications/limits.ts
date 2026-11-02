/*
 * Phase 4 limits, in one place. The database enforces the same ones: publish_update refuses more than six
 * items and captions over 2000 characters, and the public-media bucket accepts only WebP up to 5 MB.
 */
export const DERIVATIVE = {
  /** Long edge of a public image, in pixels. Photos are never enlarged to reach it. */
  longEdge: 1600,
  /** WebP quality. Chosen so flower colour and edges survive, without a heavy file. */
  quality: 80,
  /** Refuses decompression bombs before any pixels are decoded. */
  maxInputPixels: 80_000_000,
  /** Largest public derivative the bucket accepts. */
  maxBytes: 5 * 1024 * 1024,
} as const;

export const PUBLISH_LIMITS = {
  maxItems: 6,
  captionMaxLength: 2000,
  commentMaxLength: 2000,
} as const;

export const FEED_PAGE_SIZE = 12;

/** How long a signed URL for a public image lasts. Suspension and deletion take effect when it expires. */
export const PUBLIC_URL_SECONDS = 3600;

/**
 * Formats that stay private in this build. The bundled libvips decodes AV1-based HEIF, but not the HEVC
 * encoding that phone cameras use for HEIC, so a public copy cannot be made. Private Capture still accepts them.
 */
const PRIVATE_ONLY_MIME_TYPES: readonly string[] = ["image/heic", "image/heif"];

export function isPubliclyShareable(mimeType: string): boolean {
  return !PRIVATE_ONLY_MIME_TYPES.includes(mimeType);
}
