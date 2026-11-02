import { describe, expect, it } from "vitest";
import { COUNTRY_CODES } from "./country-codes";

describe("COUNTRY_CODES (ISO 3166-1 alpha-2)", () => {
  it("contains the 249 officially assigned codes", () => {
    expect(COUNTRY_CODES).toHaveLength(249);
  });

  it("uses unique, two-letter upper-case codes", () => {
    const codes = [...COUNTRY_CODES];
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("includes countries that share prefixes with excluded codes", () => {
    const codes = new Set<string>(COUNTRY_CODES);
    for (const code of ["US", "UA", "ZA", "EC", "GB", "NL", "DE", "UM"])
      expect(codes.has(code)).toBe(true);
  });

  it("excludes group, deprecated and user-assigned codes", () => {
    const codes = new Set<string>(COUNTRY_CODES);
    for (const code of ["UK", "EU", "UN", "XK", "EZ", "ZZ"]) expect(codes.has(code)).toBe(false);
  });
});
