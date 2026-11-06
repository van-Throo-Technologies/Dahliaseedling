import { describe, expect, it } from "vitest";
import {
  VISITOR_LIMIT_DEFAULT,
  VISITOR_LIMIT_MAX,
  intakeProof,
  visitorAddress,
  visitorHash,
  visitorLimitFrom,
} from "./visitor";

const SALT = "test-salt-one";

describe("which address identifies a visitor", () => {
  it("uses the last x-forwarded-for entry, which the platform appends", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.9, 192.0.2.44" });
    expect(visitorAddress(headers)).toBe("192.0.2.44");
  });

  it("ignores a client-sent x-real-ip, so changing it cannot change the visitor", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "192.0.2.44" });
    expect(visitorAddress(headers)).toBe("192.0.2.44");
    const forged = new Headers({ "x-real-ip": "198.51.100.99", "x-forwarded-for": "192.0.2.44" });
    expect(visitorAddress(forged)).toBe(visitorAddress(headers));
  });

  it("cannot be changed by a forged leading entry, because only the last entry counts", () => {
    const honest = new Headers({ "x-forwarded-for": "192.0.2.44" });
    const forged = new Headers({ "x-forwarded-for": "198.51.100.1, 192.0.2.44" });
    expect(visitorAddress(forged)).toBe(visitorAddress(honest));
  });

  it("reports no address when none is present", () => {
    expect(visitorAddress(new Headers())).toBeNull();
    expect(visitorAddress(new Headers({ "x-forwarded-for": " , " }))).toBeNull();
  });
});

describe("the visitor hash", () => {
  it("is the same for the same visitor and salt, and different for another visitor", () => {
    expect(visitorHash("203.0.113.7", SALT)).toBe(visitorHash("203.0.113.7", SALT));
    expect(visitorHash("203.0.113.7", SALT)).not.toBe(visitorHash("203.0.113.8", SALT));
  });

  it("changes when the salt changes, so rotating the salt starts every count again", () => {
    expect(visitorHash("203.0.113.7", SALT)).not.toBe(visitorHash("203.0.113.7", "test-salt-two"));
  });

  it("is a 64-character hex value that never contains the address", () => {
    const hash = visitorHash("203.0.113.7", SALT);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
  });

  it("gives every request without an address one shared bucket, so the limit still applies", () => {
    expect(visitorHash(null, SALT)).toBe(visitorHash(null, SALT));
    expect(visitorHash(null, SALT)).not.toBe(visitorHash("203.0.113.7", SALT));
  });
});

describe("the intake proof", () => {
  const VISITOR = visitorHash("203.0.113.7", SALT);
  const KEY = "3f8a1c2e-9b7d-4e21-8a55-0c1d2e3f4a5b";
  const SECRET = "intake-secret-for-the-unit-tests-0123456789";

  it("is the same for the same visitor, allowance, client key and secret", () => {
    expect(intakeProof(VISITOR, 10, KEY, SECRET)).toBe(intakeProof(VISITOR, 10, KEY, SECRET));
    expect(intakeProof(VISITOR, 10, KEY, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any bound value changes, so none of them can be altered", () => {
    const proof = intakeProof(VISITOR, 10, KEY, SECRET);
    expect(intakeProof(visitorHash("203.0.113.8", SALT), 10, KEY, SECRET)).not.toBe(proof);
    expect(intakeProof(VISITOR, 11, KEY, SECRET)).not.toBe(proof);
    expect(intakeProof(VISITOR, 10, "7c1d9e0a-2b3c-4d5e-8f90-a1b2c3d4e5f6", SECRET)).not.toBe(
      proof,
    );
    expect(intakeProof(VISITOR, 10, KEY, `${SECRET}-other`)).not.toBe(proof);
  });

  it("ignores the case of the client key, because the database compares the lowercase form", () => {
    expect(intakeProof(VISITOR, 10, KEY.toUpperCase(), SECRET)).toBe(
      intakeProof(VISITOR, 10, KEY, SECRET),
    );
  });
});

describe("the hourly allowance", () => {
  it("uses the configured value when it is a whole number in range", () => {
    expect(visitorLimitFrom("25")).toBe(25);
    expect(visitorLimitFrom(String(VISITOR_LIMIT_MAX))).toBe(VISITOR_LIMIT_MAX);
  });

  it("falls back to the default for anything unusable, so a typo never removes the limit", () => {
    for (const value of [undefined, "", "0", "-3", "2.5", "many", String(VISITOR_LIMIT_MAX + 1)]) {
      expect(visitorLimitFrom(value)).toBe(VISITOR_LIMIT_DEFAULT);
    }
  });
});
