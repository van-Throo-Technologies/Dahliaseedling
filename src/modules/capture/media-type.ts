/*
 * The media type of a chosen file, and the size guard that runs before a HEIC or HEIF photo is decoded. Browsers do not always report
 * a media type: some Android and Windows setups give a HEIC or HEIF photo an empty type or a generic "application/octet-stream". The file
 * name then decides, so a supported photo is not refused for a missing label. A declared type that is specific is always kept.
 *
 * This module runs in the browser and on the server, so it uses only standard typed arrays.
 */

const BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export function effectiveMimeType(file: { readonly name: string; readonly type: string }): string {
  const declared = file.type.trim().toLowerCase();
  if (declared !== "" && declared !== "application/octet-stream") return declared;
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return BY_EXTENSION[extension] ?? declared;
}

/** HEIC and HEIF are the same container and are decoded the same way. */
export function isHeifMime(mime: string): boolean {
  return mime === "image/heic" || mime === "image/heif";
}

/*
 * The largest image size a HEIF container declares, read from its ispe boxes, or null when none is declared. An ispe box is: size (4),
 * type "ispe" (4), version and flags (4), width (4), height (4). The type is matched by its four bytes, and the width and height follow
 * it. A photograph that declares no size is refused by the caller, so nothing large is decoded without a known size.
 */
const ISPE = [0x69, 0x73, 0x70, 0x65];

export function declaredHeifPixels(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let largest: number | null = null;
  for (let index = 0; index + 16 <= bytes.length; index += 1) {
    if (ISPE.every((value, offset) => bytes[index + offset] === value)) {
      const pixels = view.getUint32(index + 8) * view.getUint32(index + 12);
      largest = largest === null ? pixels : Math.max(largest, pixels);
    }
  }
  return largest;
}

/**
 * The address that shows a saved photograph. A HEIC or HEIF photograph is shown as a WebP preview from the owner-only preview route,
 * because browsers often cannot show it. Every other photograph keeps its existing address.
 */
export function photoSrc(mediaId: string, mime: string): string {
  return isHeifMime(mime) ? `/media/${mediaId}/preview` : `/media/${mediaId}`;
}
