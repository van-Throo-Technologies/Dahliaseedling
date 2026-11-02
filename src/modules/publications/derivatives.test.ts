import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DerivativeError, makePublicImage } from "./derivatives";
import { DERIVATIVE } from "./limits";

// The derivative module is server-only in the app. Unit tests run outside React's server runtime.
vi.mock("server-only", () => ({}));

/*
 * Synthetic fixtures only. The camera make and the GPS position are invented test values, not real places.
 * They are written into the source file so the tests can prove the public derivative does not keep them.
 */
const CAMERA = "SyntheticCam";
// A GPS tag holding a marker string, so the test can see whether location data survives. The marker stands in
// for a real position and is stored as plain text, which makes it easy to find in the bytes.
const GPS_MARKER = "SyntheticGpsArea";

async function fixtureWithLocation(
  width: number,
  height: number,
  orientation?: number,
): Promise<Buffer> {
  const pipeline = sharp({ create: { width, height, channels: 3, background: "rgb(192,80,128)" } });
  if (orientation !== undefined) {
    return pipeline.withMetadata({ orientation }).jpeg().toBuffer();
  }
  return pipeline
    .withExif({
      IFD0: { Make: CAMERA, Model: "FixtureOne" },
      IFD3: { GPSMapDatum: GPS_MARKER },
    })
    .jpeg()
    .toBuffer();
}

describe("public image derivatives", () => {
  it("drops the source's camera and GPS metadata, while the source still carries it", async () => {
    const source = await fixtureWithLocation(800, 600);
    // The fixture really does contain the metadata, so the assertions below mean something.
    expect((await sharp(source).metadata()).exif?.includes(Buffer.from(CAMERA))).toBe(true);
    expect(source.includes(Buffer.from(GPS_MARKER))).toBe(true);

    const derivative = await makePublicImage(source);
    const output = await sharp(derivative.data).metadata();
    expect(output.format).toBe("webp");
    expect(output.exif).toBeUndefined();
    expect(output.xmp).toBeUndefined();
    expect(output.icc).toBeUndefined();
    expect(derivative.data.includes(Buffer.from(CAMERA))).toBe(false);
    expect(derivative.data.includes(Buffer.from(GPS_MARKER))).toBe(false);
  });

  it("limits the long edge to 1600 pixels and keeps the aspect ratio", async () => {
    const source = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "rgb(64,96,128)" },
    })
      .jpeg()
      .toBuffer();
    const derivative = await makePublicImage(source);
    expect(derivative.width).toBe(DERIVATIVE.longEdge);
    expect(derivative.height).toBe(Math.round((2000 * DERIVATIVE.longEdge) / 3000));
    const decoded = await sharp(derivative.data).metadata();
    expect([decoded.width, decoded.height]).toEqual([derivative.width, derivative.height]);
  });

  it("never enlarges a small photograph to reach the long edge", async () => {
    const source = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "rgb(32,128,64)" },
    })
      .jpeg()
      .toBuffer();
    const derivative = await makePublicImage(source);
    expect([derivative.width, derivative.height]).toEqual([400, 300]);
  });

  it("applies the EXIF orientation to the pixels, so the image stays upright", async () => {
    // Orientation 6 means the stored pixels are rotated a quarter turn. The upright image is portrait.
    const source = await fixtureWithLocation(800, 600, 6);
    const derivative = await makePublicImage(source);
    expect([derivative.width, derivative.height]).toEqual([600, 800]);
  });

  it("leaves the private original bytes exactly as they were", async () => {
    const source = await fixtureWithLocation(800, 600);
    const before = Buffer.from(source);
    await makePublicImage(source);
    expect(source.equals(before)).toBe(true);
  });

  it("refuses bytes that are not an image, with a message a grower can read", async () => {
    await expect(makePublicImage(Buffer.from("not a picture at all"))).rejects.toBeInstanceOf(
      DerivativeError,
    );
    await expect(makePublicImage(Buffer.from("not a picture at all"))).rejects.toThrow(
      "The photo could not be prepared for sharing.",
    );
  });

  it("produces a derivative that is a smaller file than a large source, with a clear quality setting", async () => {
    const source = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "rgb(128,80,64)" },
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    const derivative = await makePublicImage(source);
    expect(derivative.data.byteLength).toBeLessThan(source.byteLength);
    expect(derivative.data.byteLength).toBeLessThanOrEqual(DERIVATIVE.maxBytes);
  });
});
