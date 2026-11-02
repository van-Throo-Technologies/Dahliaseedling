import { describe, expect, it } from "vitest";
import {
  SEEDLING_LIMITS,
  isUuid,
  normalizeSeriesName,
  validateCultivarName,
  validateFirstGrownYear,
  validateParentInput,
  validateSeriesChoice,
  validateSeriesName,
  validateVisibility,
  validateWorkingName,
} from "./validation";

const UUID = "11111111-2222-4333-8444-555555555555";

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("series names (identifier prefixes)", () => {
  it("normalises to upper case and accepts 1 to 8 letters or digits", () => {
    expect(normalizeSeriesName(" jv ")).toBe("JV");
    expect(validateSeriesName("jv")).toEqual({ ok: true, value: "JV" });
    expect(validateSeriesName("AB12CD34")).toEqual({ ok: true, value: "AB12CD34" });
  });

  it("rejects empty, too long, and symbol-bearing names", () => {
    expect(validateSeriesName("")).toMatchObject({
      ok: false,
      fieldErrors: { name: { key: "validation.series.required" } },
    });
    expect(validateSeriesName("TOOLONGNAME")).toMatchObject({ ok: false });
    expect(validateSeriesName("J-V")).toMatchObject({ ok: false });
    expect(validateSeriesName("J V")).toMatchObject({ ok: false });
  });

  it("does not hard-code any prefix", () => {
    expect(validateSeriesName("VT")).toEqual({ ok: true, value: "VT" });
  });
});

describe("working names", () => {
  it("is optional and trimmed", () => {
    expect(validateWorkingName("")).toEqual({ ok: true, value: null });
    expect(validateWorkingName("  Velvet Dusk  ")).toEqual({ ok: true, value: "Velvet Dusk" });
  });

  it("enforces the length limit", () => {
    expect(validateWorkingName("x".repeat(SEEDLING_LIMITS.workingNameMax + 1))).toMatchObject({
      ok: false,
    });
  });
});

describe("first grown year", () => {
  it("is optional and must be a whole year in range", () => {
    expect(validateFirstGrownYear("")).toEqual({ ok: true, value: null });
    expect(validateFirstGrownYear("2024")).toEqual({ ok: true, value: 2024 });
    expect(validateFirstGrownYear("1899")).toMatchObject({ ok: false });
    expect(validateFirstGrownYear("2101")).toMatchObject({ ok: false });
    expect(validateFirstGrownYear("2024.5")).toMatchObject({ ok: false });
    expect(validateFirstGrownYear("next year")).toMatchObject({ ok: false });
  });
});

describe("visibility and series choice", () => {
  it("accepts only private or public", () => {
    expect(validateVisibility("private")).toEqual({ ok: true, value: "private" });
    expect(validateVisibility("public")).toEqual({ ok: true, value: "public" });
    expect(validateVisibility("friends")).toMatchObject({ ok: false });
  });

  it("treats an empty choice as automatic numbering only", () => {
    expect(validateSeriesChoice("")).toEqual({ ok: true, value: null });
    expect(validateSeriesChoice(UUID)).toEqual({ ok: true, value: UUID });
    expect(validateSeriesChoice("JV")).toMatchObject({ ok: false });
  });
});

describe("cultivar names and UUIDs", () => {
  it("collapses spaces and enforces length", () => {
    expect(validateCultivarName("  Wizard   of Oz ")).toBe("Wizard of Oz");
    expect(validateCultivarName("A")).toBeNull();
    expect(validateCultivarName("x".repeat(81))).toBeNull();
  });

  it("recognises canonical UUIDs only", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});

describe("parent input", () => {
  it("allows a seed parent to be unknown while the pollen parent is absent", () => {
    expect(validateParentInput(formOf({ role: "seed_parent", kind: "unknown" }))).toEqual({
      ok: true,
      value: {
        role: "seed_parent",
        kind: "unknown",
        parentSeedlingId: null,
        cultivarName: "",
        notes: null,
      },
    });
  });

  it("requires a seedling id for a seedling parent", () => {
    expect(validateParentInput(formOf({ role: "pollen_parent", kind: "seedling" }))).toMatchObject({
      ok: false,
      fieldErrors: { parentSeedlingId: { key: "validation.seedling.parentChoose" } },
    });
    expect(
      validateParentInput(
        formOf({ role: "pollen_parent", kind: "seedling", parentSeedlingId: UUID }),
      ),
    ).toMatchObject({ ok: true, value: { parentSeedlingId: UUID } });
  });

  it("requires a cultivar name for a cultivar parent and drops ids for other kinds", () => {
    expect(
      validateParentInput(formOf({ role: "seed_parent", kind: "cultivar", cultivarName: "" })),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        cultivarName: expect.objectContaining({ key: "validation.seedling.cultivar" }),
      },
    });
    expect(
      validateParentInput(
        formOf({
          role: "seed_parent",
          kind: "unknown",
          parentSeedlingId: UUID,
          cultivarName: "Ignored",
        }),
      ),
    ).toMatchObject({ ok: true, value: { parentSeedlingId: null, cultivarName: "" } });
  });

  it("rejects an unsupported role or kind", () => {
    expect(validateParentInput(formOf({ role: "grandparent", kind: "none" }))).toMatchObject({
      ok: false,
    });
    expect(validateParentInput(formOf({ role: "seed_parent", kind: "dna" }))).toMatchObject({
      ok: false,
    });
  });
});
