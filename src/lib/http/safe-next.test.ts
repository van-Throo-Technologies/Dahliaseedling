import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site absolute paths", () => {
    expect(safeNextPath("/capture")).toBe("/capture");
    expect(safeNextPath("/profiles/abc?tab=1")).toBe("/profiles/abc?tab=1");
  });

  it.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a relative path", "capture"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a path with a newline", "/capture\nLocation: //evil"],
    ["an empty string", ""],
  ])("falls back to the default for %s", (_label, value) => {
    expect(safeNextPath(value, "/")).toBe("/");
  });

  it("falls back for non-string input (for example a repeated query parameter)", () => {
    expect(safeNextPath(["/a", "/b"], "/home")).toBe("/home");
    expect(safeNextPath(null)).toBe("/");
  });
});
