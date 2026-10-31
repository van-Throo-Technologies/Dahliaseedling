import { describe, expect, it } from "vitest";
import { countryName, formatMemberSince } from "./presentation";

describe("countryName", () => {
  it("returns the display name for a known code", () => {
    expect(countryName("NL")).toBe("Netherlands");
  });

  it("falls back to the code for an unknown one", () => {
    expect(countryName("XX")).toBe("XX");
  });
});

describe("formatMemberSince", () => {
  it("renders the month and year in the app locale from a UTC timestamp", () => {
    expect(formatMemberSince("2026-10-15T12:00:00.000Z")).toBe("Member since October 2026");
  });
});
