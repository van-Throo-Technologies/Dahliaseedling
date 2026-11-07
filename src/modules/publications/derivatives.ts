import "server-only";

import sharp, { type Sharp } from "sharp";
import { declaredHeifPixels, isHeifMime } from "@/modules/capture/media-type";
import { DERIVATIVE } from "./limits";
import { DerivativeError } from "./derivatives.error";

/*
 * Public image derivatives. A public image is never the private original. It is a new WebP built from
 * the original's pixels, so every piece of source metadata is dropped: EXIF (camera, time and any GPS
 * position), XMP and the embedded colour profile. The orientation is applied to the pixels before the
 * tags are dropped, so the image is still upright.
 *
 * HEIC and HEIF are decoded first, because the bundled libvips cannot read the HEVC encoding that phone
 * cameras use. Only those formats take the decoder path, so an ordinary JPEG, PNG or WebP is never converted
 * twice. Before a HEIF file is decoded, its declared size is checked, so a file that claims a huge image is
 * refused before any large buffer is allocated.
 *
 * sharp and the decoder run in the Node.js runtime, inside the server action that publishes. The original is read and
 * the derivative is written with the caller's own session, so no extra service or privileged key is used.
 */

export { DerivativeError };

export interface PublicImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

async function heifPipeline(original: Buffer): Promise<Sharp> {
  const declared = declaredHeifPixels(original);
  if (declared === null || declared > DERIVATIVE.maxHeifPixels) {
    throw new DerivativeError("errors.publication.preparationFailed");
  }
  // Loaded only when a HEIF is shared, so the decoder is not part of the work for any other photograph.
  const { default: decode } = await import("heic-decode");
  const { width, height, data } = await decode({ buffer: original });
  if (width * height > DERIVATIVE.maxHeifPixels) {
    throw new DerivativeError("errors.publication.preparationFailed");
  }
  return sharp(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width, height, channels: 4 },
    limitInputPixels: DERIVATIVE.maxInputPixels,
    failOn: "error",
  });
}

export async function makePublicImage(
  original: Buffer,
  mimeType = "image/jpeg",
): Promise<PublicImage> {
  try {
    const source = isHeifMime(mimeType)
      ? await heifPipeline(original)
      : sharp(original, {
          limitInputPixels: DERIVATIVE.maxInputPixels,
          failOn: "error",
        });
    const { data, info } = await source
      // Apply the EXIF orientation to the pixels. Without this the image would turn sideways once
      // the orientation tag is removed. A decoded HEIF arrives already upright, so this is a no-op for it.
      .rotate()
      // Fit inside the long-edge box, keep the aspect ratio, and never enlarge a small photograph.
      .resize({
        width: DERIVATIVE.longEdge,
        height: DERIVATIVE.longEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      // No withMetadata() or keepMetadata(): sharp writes no EXIF, XMP or ICC data by default.
      .webp({ quality: DERIVATIVE.quality })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof DerivativeError) throw error;
    throw new DerivativeError("errors.publication.preparationFailed");
  }
}
