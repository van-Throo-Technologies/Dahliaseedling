import { describe, expect, it } from "vitest";
import { countryName, formatMemberSinceMonth } from "./presentation";

describe("countryName", () => {
  it("returns the display name in the interface language for a known code", () => {
    expect(countryName("NL", "en")).toBe("Netherlands");
    expect(countryName("NL", "nl")).toBe("Nederland");
    expect(countryName("NL", "fr")).toBe("Pays-Bas");
  });

  it("never shows the stored code in place of the name", () => {
    expect(countryName("NL", "fr")).not.toBe("NL");
  });

  it("falls back to the code for an unknown one", () => {
    expect(countryName("XX", "en")).toBe("XX");
  });
});

describe("formatMemberSinceMonth", () => {
  it("renders the month and year in the interface language from a UTC timestamp", () => {
    expect(formatMemberSinceMonth("2026-10-15T12:00:00.000Z", "en")).toBe("October 2026");
    expect(formatMemberSinceMonth("2026-10-15T12:00:00.000Z", "nl")).toBe("oktober 2026");
    expect(formatMemberSinceMonth("2026-10-15T12:00:00.000Z", "fr")).toBe("octobre 2026");
  });
});
