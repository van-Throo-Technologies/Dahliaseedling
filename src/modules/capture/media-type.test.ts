import { describe, expect, it } from "vitest";
import { declaredHeifPixels, effectiveMimeType, isHeifMime } from "./media-type";

describe("the media type of a chosen file", () => {
  it("keeps a specific declared type", () => {
    expect(effectiveMimeType({ name: "bloom.jpg", type: "image/png" })).toBe("image/png");
    expect(effectiveMimeType({ name: "bloom.heic", type: "image/heic" })).toBe("image/heic");
  });

  it("reads a HEIC or HEIF file with no declared type from its name, in any letter case", () => {
    expect(effectiveMimeType({ name: "IMG_0042.HEIC", type: "" })).toBe("image/heic");
    expect(effectiveMimeType({ name: "IMG_0043.heif", type: "application/octet-stream" })).toBe(
      "image/heif",
    );
  });

  it("reads the other accepted photo and video types from their names when no type is declared", () => {
    expect(effectiveMimeType({ name: "bloom.jpeg", type: "" })).toBe("image/jpeg");
    expect(effectiveMimeType({ name: "clip.mov", type: "" })).toBe("video/quicktime");
  });

  it("leaves an unknown file as unknown, so it is still refused", () => {
    expect(effectiveMimeType({ name: "notes.gif", type: "" })).toBe("");
    expect(effectiveMimeType({ name: "archive", type: "application/octet-stream" })).toBe(
      "application/octet-stream",
    );
  });

  it("recognises HEIC and HEIF, and nothing else, as the decoded families", () => {
    expect(isHeifMime("image/heic")).toBe(true);
    expect(isHeifMime("image/heif")).toBe(true);
    expect(isHeifMime("image/jpeg")).toBe(false);
  });
});

/** An ispe box declaring the given size, as it appears inside a HEIF container. */
function ispe(width: number, height: number): Buffer {
  const box = Buffer.alloc(20);
  box.writeUInt32BE(20, 0);
  box.write("ispe", 4, "latin1");
  box.writeUInt32BE(0, 8);
  box.writeUInt32BE(width, 12);
  box.writeUInt32BE(height, 16);
  return box;
}

describe("the declared size of a HEIF container, read before any decoding", () => {
  it("reads the declared width and height", () => {
    expect(declaredHeifPixels(ispe(4032, 3024))).toBe(4032 * 3024);
  });

  it("takes the largest declared size when a container declares several", () => {
    const bytes = Buffer.concat([ispe(160, 120), Buffer.alloc(8), ispe(4032, 3024)]);
    expect(declaredHeifPixels(bytes)).toBe(4032 * 3024);
  });

  it("reports nothing declared when the container has no size box", () => {
    expect(declaredHeifPixels(Buffer.from("not a heif container at all"))).toBeNull();
  });
});
