import "server-only";

import sharp from "sharp";
import { DERIVATIVE } from "./limits";

/*
 * Public image derivatives. A public image is never the private original. It is a new WebP built from
 * the original's pixels, so every piece of source metadata is dropped: EXIF (camera, time and any GPS
 * position), XMP and the embedded colour profile. The orientation is applied to the pixels before the
 * tags are dropped, so the image is still upright.
 *
 * sharp runs in the Node.js runtime, inside the server action that publishes. The original is read and
 * the derivative is written with the caller's own session, so no extra service or privileged key is used.
 */

export interface PublicImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

import { DerivativeError } from "./derivatives.error";

export { DerivativeError };

export async function makePublicImage(original: Buffer): Promise<PublicImage> {
  try {
    const { data, info } = await sharp(original, {
      limitInputPixels: DERIVATIVE.maxInputPixels,
      failOn: "error",
    })
      // Apply the EXIF orientation to the pixels. Without this the image would turn sideways once
      // the orientation tag is removed.
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
  } catch {
    throw new DerivativeError("errors.publication.preparationFailed");
  }
}
