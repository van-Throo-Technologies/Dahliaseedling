import { describe, expect, it } from "vitest";
import { LOCALES } from "../locales";
import { MESSAGES } from "./index";

/** Every dotted path to a message string, with its text. */
function leaves(tree: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.set(path, value);
    } else {
      for (const [inner, text] of leaves(value, path)) out.set(inner, text);
    }
  }
  return out;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "").sort();
}

describe("message dictionaries", () => {
  const english = leaves(MESSAGES.en);

  for (const locale of LOCALES) {
    describe(locale, () => {
      const translated = leaves(MESSAGES[locale]);

      it("has exactly the English keys, no more and no fewer", () => {
        expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
      });

      it("has no empty message", () => {
        for (const [key, text] of translated) expect(text.trim(), key).not.toBe("");
      });

      it("uses the same placeholders as English, so values are never dropped", () => {
        for (const [key, text] of english) {
          expect(placeholders(translated.get(key) ?? ""), key).toEqual(placeholders(text));
        }
      });
    });
  }
});
