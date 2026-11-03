import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import { createTranslator } from "@/i18n/translator";
import { SEARCH_QUERY_MAX, normalizeSearchIdentifier, normalizeSearchText } from "./normalize";
import { validateSearch } from "./validation";

describe("normalizeSearchText", () => {
  it("ignores case and surrounding or repeated whitespace", () => {
    expect(normalizeSearchText("  Sunset    Surprise ")).toBe("sunset surprise");
    expect(normalizeSearchText("WIZARD\tOF OZ")).toBe("wizard of oz");
  });

  it("keeps punctuation and accents, so distinct names stay distinct", () => {
    expect(normalizeSearchText("Café au Lait")).toBe("café au lait");
    expect(normalizeSearchText("Cafe au Lait")).not.toBe(normalizeSearchText("Café au Lait"));
  });

  it("treats an empty or blank query as no query", () => {
    expect(normalizeSearchText("")).toBeNull();
    expect(normalizeSearchText("   ")).toBeNull();
  });
});

describe("normalizeSearchIdentifier", () => {
  it("drops one leading # and ignores case, so #1 finds automatic number 1", () => {
    expect(normalizeSearchIdentifier("#1")).toBe("1");
    expect(normalizeSearchIdentifier(" jv-26-014 ")).toBe("JV-26-014");
  });

  it("keeps identifier punctuation, so different series numbers never merge", () => {
    expect(normalizeSearchIdentifier("JV-26-014")).not.toBe(normalizeSearchIdentifier("JV-26-41"));
    expect(normalizeSearchIdentifier("JV-26-014")).toBe("JV-26-014");
  });

  it("never alters the stored identifier itself", () => {
    const stored = "JV-26-014";
    normalizeSearchIdentifier(stored);
    expect(stored).toBe("JV-26-014");
  });
});

describe("validateSearch", () => {
  it("accepts a query and an optional country, normalising blank input to null", () => {
    expect(validateSearch({ q: "  Wizard  of Oz ", country: "be" })).toEqual({
      ok: true,
      value: { query: "Wizard of Oz", country: "BE", available: false },
    });
    expect(validateSearch({})).toEqual({
      ok: true,
      value: { query: null, country: null, available: false },
    });
    expect(validateSearch({ q: "   ", country: "" })).toEqual({
      ok: true,
      value: { query: null, country: null, available: false },
    });
  });

  it("refuses a query that is too long, rather than cutting it short", () => {
    const result = validateSearch({ q: "x".repeat(SEARCH_QUERY_MAX + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.q).toEqual({
        key: "search.validation.tooLong",
        values: { max: SEARCH_QUERY_MAX },
      });
    }
  });

  it("refuses a country that is not on the ISO list", () => {
    const result = validateSearch({ country: "XX" });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.fieldErrors.country).toEqual({ key: "search.validation.country" });
  });

  it("uses only the first value when a parameter is repeated", () => {
    expect(validateSearch({ q: ["Sunset", "Other"] })).toEqual({
      ok: true,
      value: { query: "Sunset", country: null, available: false },
    });
  });
});

describe("search dictionaries", () => {
  it("never puts a user-authored name into a translated sentence", () => {
    const t = createTranslator(MESSAGES.fr);
    const sentence = t("search.resultsFor", { query: "Wizard of Oz" });
    expect(sentence).toContain("Wizard of Oz");
    expect(MESSAGES.fr.search.resultsFor).not.toContain("Wizard");
  });
});
