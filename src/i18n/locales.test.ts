import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, negotiateLocale, resolveLocale } from "./locales";

describe("isLocale", () => {
  it("accepts only the supported codes, exactly", () => {
    expect(isLocale("nl")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("NL")).toBe(false);
    expect(isLocale("nl-BE")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("negotiateLocale", () => {
  it("falls back to English without a header", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });

  it("uses the first supported language in preference order", () => {
    expect(negotiateLocale("nl-NL,nl;q=0.9,en;q=0.8")).toBe("nl");
    expect(negotiateLocale("fr-BE")).toBe("fr");
  });

  it("honours quality weights rather than list order", () => {
    expect(negotiateLocale("de;q=0.9,fr;q=0.5,nl;q=0.7")).toBe("nl");
  });

  it("skips unsupported languages and falls back to English", () => {
    expect(negotiateLocale("de-DE,it;q=0.8")).toBe("en");
    expect(negotiateLocale("de,fr;q=0")).toBe("en");
  });

  it("ignores malformed input rather than failing", () => {
    expect(negotiateLocale(";;;,,,")).toBe("en");
    expect(negotiateLocale("fr;q=abc")).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("lets an explicit choice win over the browser language", () => {
    expect(resolveLocale("fr", "nl")).toBe("fr");
  });

  it("uses the browser language when there is no explicit choice", () => {
    expect(resolveLocale(undefined, "nl")).toBe("nl");
    expect(resolveLocale(null, "nl")).toBe("nl");
  });

  it("ignores an unsupported explicit choice and keeps the browser language", () => {
    expect(resolveLocale("de", "nl")).toBe("nl");
    expect(resolveLocale("de", null)).toBe(DEFAULT_LOCALE);
  });

  it("defaults to English when nothing is known", () => {
    expect(resolveLocale(undefined, undefined)).toBe("en");
  });
});
