import { describe, expect, it } from "vitest";
import { isRateLimited, RATE_LIMITED_CODE } from "./rate-limit";

describe("isRateLimited", () => {
  it("recognises only the rate-limit SQLSTATE", () => {
    expect(RATE_LIMITED_CODE).toBe("53400");
    expect(isRateLimited({ code: "53400" })).toBe(true);
    expect(isRateLimited({ code: "42501" })).toBe(false);
    expect(isRateLimited({ code: "23514" })).toBe(false);
    expect(isRateLimited(null)).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
  });
});
