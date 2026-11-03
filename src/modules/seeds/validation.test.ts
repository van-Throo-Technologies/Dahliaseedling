import { describe, expect, it } from "vitest";
import {
  validateInterestQuantity,
  validateOffer,
  validatePhoto,
  type OfferForm,
} from "./validation";

const base: OfferForm = {
  kind: "seedling",
  cultivarName: "",
  description: "",
  material: "loose_seeds",
  packetSize: "12",
  seedheadCount: "",
  mode: "free",
  price: "",
  handover: "pickup",
  note: "",
  hasSourcePhoto: false,
  hasParentPhoto: false,
};

describe("offer input", () => {
  it("accepts a seedling source with a packet count", () => {
    expect(validateOffer(base)).toEqual({
      ok: true,
      value: {
        kind: "seedling",
        cultivarName: null,
        description: null,
        material: "loose_seeds",
        packetSize: 12,
        seedheadCount: null,
        mode: "free",
        price: null,
        handover: "pickup",
        note: null,
      },
    });
  });

  it("refuses an unidentified dahlia without a photograph of the actual plant", () => {
    expect(validateOffer({ ...base, kind: "unidentified" })).toEqual({
      ok: false,
      key: "seeds.errors.sourcePhotoRequired",
    });
  });

  it("accepts an unidentified dahlia with its photograph and an optional description, and never a cultivar name", () => {
    const result = validateOffer({
      ...base,
      kind: "unidentified",
      description: "  Dark   burgundy decorative  ",
      hasSourcePhoto: true,
    });
    expect(result).toMatchObject({
      ok: true,
      value: { kind: "unidentified", description: "Dark burgundy decorative", cultivarName: null },
    });
  });

  it("refuses a named cultivar without a name, or without a photograph of the actual parent plant", () => {
    expect(validateOffer({ ...base, kind: "cultivar", cultivarName: "x" })).toEqual({
      ok: false,
      key: "seeds.errors.cultivarName",
    });
    expect(validateOffer({ ...base, kind: "cultivar", cultivarName: "Cafe au Lait" })).toEqual({
      ok: false,
      key: "seeds.errors.parentPhotoRequired",
    });
    expect(
      validateOffer({
        ...base,
        kind: "cultivar",
        cultivarName: "Cafe au Lait",
        hasParentPhoto: true,
      }),
    ).toMatchObject({ ok: true });
  });

  it("accepts unknown or mixed with no photograph", () => {
    expect(validateOffer({ ...base, kind: "unknown_mixed", packetSize: "" })).toEqual({
      ok: false,
      key: "seeds.errors.packetSize",
    });
    expect(validateOffer({ ...base, kind: "unknown_mixed" })).toMatchObject({
      ok: true,
      value: { kind: "unknown_mixed" },
    });
  });

  it("uses a seed count for loose seeds and a head count for seedheads, never both", () => {
    expect(
      validateOffer({ ...base, material: "seedheads", packetSize: "", seedheadCount: "3" }),
    ).toMatchObject({
      ok: true,
      value: { material: "seedheads", seedheadCount: 3, packetSize: null },
    });
    expect(validateOffer({ ...base, material: "seedheads", seedheadCount: "0" })).toEqual({
      ok: false,
      key: "seeds.errors.seedheadCount",
    });
    expect(validateOffer({ ...base, packetSize: "1.5" })).toEqual({
      ok: false,
      key: "seeds.errors.packetSize",
    });
  });

  it("keeps a price only for a sale, and refuses a price for free or trade", () => {
    expect(validateOffer({ ...base, mode: "for_sale", price: "5 EUR" })).toMatchObject({
      ok: true,
      value: { price: "5 EUR" },
    });
    expect(validateOffer({ ...base, mode: "free", price: "5 EUR" })).toEqual({
      ok: false,
      key: "seeds.errors.price",
    });
    expect(validateOffer({ ...base, mode: "trade", price: "" })).toMatchObject({
      ok: true,
      value: { price: null },
    });
  });

  it("refuses an unknown mode, handover or source kind", () => {
    expect(validateOffer({ ...base, mode: "checkout" })).toEqual({
      ok: false,
      key: "seeds.errors.mode",
    });
    expect(validateOffer({ ...base, handover: "courier" })).toEqual({
      ok: false,
      key: "seeds.errors.handover",
    });
    expect(validateOffer({ ...base, kind: "germinated" })).toEqual({
      ok: false,
      key: "seeds.errors.sourceRequired",
    });
  });

  it("limits the note to 280 characters", () => {
    expect(validateOffer({ ...base, note: "x".repeat(281) })).toEqual({
      ok: false,
      key: "seeds.errors.note",
    });
  });
});

describe("photographs and quantities", () => {
  it("accepts JPEG, PNG and WebP up to the limit, and refuses anything else", () => {
    expect(validatePhoto({ type: "image/jpeg", size: 1000 })).toEqual({ ok: true, value: true });
    expect(validatePhoto({ type: "image/heic", size: 1000 })).toEqual({
      ok: false,
      key: "seeds.errors.photoType",
    });
    expect(validatePhoto({ type: "image/png", size: 3 * 1024 * 1024 })).toEqual({
      ok: false,
      key: "seeds.errors.photoSize",
    });
    expect(validatePhoto({ type: "image/webp", size: 0 })).toEqual({
      ok: false,
      key: "seeds.errors.photoSize",
    });
  });

  it("keeps an interest quantity to 80 characters and treats blank as none", () => {
    expect(validateInterestQuantity("  ")).toEqual({ ok: true, value: null });
    expect(validateInterestQuantity("two packets")).toEqual({ ok: true, value: "two packets" });
    expect(validateInterestQuantity("x".repeat(81))).toEqual({
      ok: false,
      key: "seeds.errors.quantity",
    });
  });
});
