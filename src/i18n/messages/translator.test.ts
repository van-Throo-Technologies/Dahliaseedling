import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator, type MessageKey } from "../translator";
import { MESSAGES } from "./index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createTranslator", () => {
  it("returns the message for the active language", () => {
    expect(createTranslator(MESSAGES.nl)("common.save")).toBe(MESSAGES.nl.common.save);
  });

  it("inserts values as plain text, never as markup", () => {
    const t = createTranslator(MESSAGES.en);
    expect(t("validation.password.min", { min: 8 })).toContain("8");
    expect(t("validation.capture.fileSize", { megabytes: "<b>15</b>" })).toContain("<b>15</b>");
  });

  it("reports a key that does not exist and returns nothing instead of the raw key", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = createTranslator(MESSAGES.fr);
    expect(t("app.doesNotExist" as MessageKey)).toBe("");
    expect(error).toHaveBeenCalledWith("Missing translation: app.doesNotExist");
  });
});
