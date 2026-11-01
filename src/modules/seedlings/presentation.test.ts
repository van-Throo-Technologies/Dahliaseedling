import { describe, expect, it } from "vitest";
import { formatDate, patternExample, roleLabel, visibilityLabel } from "./presentation";

describe("patternExample", () => {
  const twenty26 = new Date("2026-06-01T12:00:00Z");

  it("fills the two-digit year and a three-digit sequence", () => {
    expect(patternExample("JV-{YY}-{NNN}", twenty26)).toBe("JV-26-001");
  });

  it("supports a pattern without the year", () => {
    expect(patternExample("VT-{NNN}", twenty26)).toBe("VT-001");
  });

  it("uses the year in UTC so the example does not change at a local boundary", () => {
    expect(patternExample("JV-{YY}-{NNN}", new Date("2027-01-01T00:30:00Z"))).toBe("JV-27-001");
  });
});

describe("labels", () => {
  it("names parent roles and visibility in plain words", () => {
    expect(roleLabel("seed_parent")).toBe("Seed parent");
    expect(roleLabel("pollen_parent")).toBe("Pollen parent");
    expect(visibilityLabel("private")).toBe("Private");
    expect(visibilityLabel("public")).toBe("Public");
  });

  it("formats a stored timestamp as a calendar date", () => {
    expect(formatDate("2026-10-31T23:30:00Z")).toBe("October 31, 2026");
  });
});
