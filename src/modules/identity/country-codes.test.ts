import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./country-codes";

describe("COUNTRIES (ISO 3166-1 alpha-2)", () => {
  it("contains the 249 officially assigned codes", () => {
    expect(COUNTRIES).toHaveLength(249);
  });

  it("uses unique, two-letter upper-case codes", () => {
    const codes = COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("includes countries that share prefixes with excluded codes", () => {
    const codes = new Set<string>(COUNTRIES.map((country) => country.code));
    for (const code of ["US", "UA", "ZA", "EC", "GB", "NL", "DE", "UM"])
      expect(codes.has(code)).toBe(true);
  });

  it("excludes group, deprecated and user-assigned codes", () => {
    const codes = new Set<string>(COUNTRIES.map((country) => country.code));
    for (const code of ["UK", "EU", "UN", "XK", "EZ", "ZZ"]) expect(codes.has(code)).toBe(false);
  });
});
