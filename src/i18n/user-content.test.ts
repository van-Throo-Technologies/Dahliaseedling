import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";
import { createTranslator } from "./translator";
import { MESSAGES } from "./messages";

/*
 * User-authored and domain names are values, never dictionary text. Whatever the interface language, a value that
 * is passed in must come out exactly as it went in, with only the surrounding words changing.
 */
const USER_CONTENT = [
  "Wizard of Oz",
  "Boom Boom White",
  "Café au Lait",
  "Arabian Night",
  "Sunset Surprise",
  "JV-26-014",
  "First flower after the storm.",
  "I love the shape of this one.",
];

describe("user content is inserted, never translated", () => {
  for (const locale of LOCALES) {
    it(`keeps every sample value byte-identical in ${locale}`, () => {
      const t = createTranslator(MESSAGES[locale]);
      for (const value of USER_CONTENT) {
        const sentence = t("seedlings.label.automatic", { seedling: value, number: 14 });
        expect(sentence, value).toContain(value);
        expect(sentence, value).toContain("#14");
      }
    });
  }

  it("keeps the value identical when the language is French", () => {
    const en = createTranslator(MESSAGES.en)("seedlings.label.automatic", {
      seedling: "Wizard of Oz",
      number: 14,
    });
    const fr = createTranslator(MESSAGES.fr)("seedlings.label.automatic", {
      seedling: "Wizard of Oz",
      number: 14,
    });
    expect(en).toBe("Wizard of Oz #14");
    expect(fr).toContain("Wizard of Oz");
    expect(fr).toContain("#14");
  });
});
