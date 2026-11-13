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
  /**
   * Largest declared size of a HEIC or HEIF photo that is decoded for sharing: about 50 megapixels, which covers current phone main cameras. The decoder
   * holds about four bytes per pixel, so this bounds the memory a single publish can use.
   */
  maxHeifPixels: 50_000_000,
  /** Largest public derivative the bucket accepts. */
  maxBytes: 5 * 1024 * 1024,
} as const;

export const PUBLISH_LIMITS = {
  maxItems: 6,
  captionMaxLength: 2000,
  commentMaxLength: 2000,
} as const;

export const FEED_PAGE_SIZE = 12;

/** How many of the most recent comments a Feed card shows before its "View all comments" link. */
export const FEED_COMMENT_LIMIT = 5;

/** How long a signed URL for a public image lasts. Suspension and deletion take effect when it expires. */
export const PUBLIC_URL_SECONDS = 3600;

/** The photograph types a public copy can be made from. HEIC and HEIF are decoded when they are published. Video is not shared publicly. */
const SHAREABLE_PHOTO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function isPubliclyShareable(mimeType: string): boolean {
  return SHAREABLE_PHOTO_TYPES.includes(mimeType);
}
