import { describe, expect, it } from "vitest";
import { FEEDBACK_MESSAGE_MAX, isFeedbackCategory, isFeedbackMessageValid } from "./validation";

describe("feedback validation", () => {
  it("accepts only the three categories", () => {
    expect(["idea", "problem", "experience"].every(isFeedbackCategory)).toBe(true);
    expect(isFeedbackCategory("praise")).toBe(false);
    expect(isFeedbackCategory("IDEA")).toBe(false);
    expect(isFeedbackCategory(undefined)).toBe(false);
  });

  it("requires one to 2000 characters after trimming", () => {
    expect(isFeedbackMessageValid("")).toBe(false);
    expect(isFeedbackMessageValid("   ")).toBe(false);
    expect(isFeedbackMessageValid("a")).toBe(true);
    expect(isFeedbackMessageValid("x".repeat(FEEDBACK_MESSAGE_MAX))).toBe(true);
    expect(isFeedbackMessageValid("x".repeat(FEEDBACK_MESSAGE_MAX + 1))).toBe(false);
    expect(isFeedbackMessageValid(`  ${"x".repeat(FEEDBACK_MESSAGE_MAX)}  `)).toBe(true);
  });
});
