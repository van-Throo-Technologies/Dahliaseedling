import { describe, expect, it } from "vitest";
import {
  STAGING_ATTEMPT_LIMITS,
  clearAttempts,
  isAttemptLimited,
  recordFailedAttempt,
} from "./staging-attempts";

const NOW = 1_800_000_000;

describe("staging attempt limit", () => {
  it("allows attempts until the limit, then refuses them", () => {
    const address = "203.0.113.10";
    for (let i = 0; i < STAGING_ATTEMPT_LIMITS.maxFailures - 1; i += 1) {
      recordFailedAttempt(address, NOW);
    }
    expect(isAttemptLimited(address, NOW)).toBe(false);
    recordFailedAttempt(address, NOW);
    expect(isAttemptLimited(address, NOW)).toBe(true);
  });

  it("lifts the refusal when the window ends", () => {
    const address = "203.0.113.11";
    for (let i = 0; i < STAGING_ATTEMPT_LIMITS.maxFailures; i += 1) {
      recordFailedAttempt(address, NOW);
    }
    expect(isAttemptLimited(address, NOW + STAGING_ATTEMPT_LIMITS.windowSeconds - 1)).toBe(true);
    expect(isAttemptLimited(address, NOW + STAGING_ATTEMPT_LIMITS.windowSeconds)).toBe(false);
  });

  it("clears the count after a correct password", () => {
    const address = "203.0.113.12";
    for (let i = 0; i < STAGING_ATTEMPT_LIMITS.maxFailures; i += 1) {
      recordFailedAttempt(address, NOW);
    }
    clearAttempts(address);
    expect(isAttemptLimited(address, NOW)).toBe(false);
  });

  it("counts each address separately", () => {
    const limited = "203.0.113.13";
    const other = "203.0.113.14";
    for (let i = 0; i < STAGING_ATTEMPT_LIMITS.maxFailures; i += 1) {
      recordFailedAttempt(limited, NOW);
    }
    expect(isAttemptLimited(limited, NOW)).toBe(true);
    expect(isAttemptLimited(other, NOW)).toBe(false);
  });
});
