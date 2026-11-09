import { describe, expect, it } from "vitest";
import {
  STAGING_GATE_MAX_AGE_SECONDS,
  issueStagingToken,
  isValidStagingToken,
  passwordMatches,
  safeNextPath,
  stagingDecision,
  stagingGate,
} from "./staging-gate";

const PASSWORD = "a-long-shared-testing-phrase";
const NOW = 1_800_000_000;
const STAGING = { VERCEL_GIT_COMMIT_REF: "staging", STAGING_ACCESS_PASSWORD: PASSWORD };

describe("stagingGate", () => {
  it("is off when no password is configured", () => {
    expect(stagingGate({})).toEqual({ state: "off" });
    expect(stagingGate({ STAGING_ACCESS_PASSWORD: "" })).toEqual({ state: "off" });
  });

  it("is off on the production branch, even when the password is set there by mistake", () => {
    expect(stagingGate({ ...STAGING, VERCEL_GIT_COMMIT_REF: "main" })).toEqual({ state: "off" });
  });

  it("fails closed when the password is too short", () => {
    expect(stagingGate({ ...STAGING, STAGING_ACCESS_PASSWORD: "short" })).toEqual({
      state: "misconfigured",
    });
  });

  it("is on for a valid password on any other branch", () => {
    expect(stagingGate(STAGING)).toEqual({ state: "on", password: PASSWORD });
  });
});

describe("stagingDecision", () => {
  const on = stagingGate(STAGING);

  it("allows everything when the gate is off", () => {
    expect(stagingDecision({ state: "off" }, "/capture", undefined, NOW)).toBe("allow");
  });

  it("refuses everything when the gate is misconfigured", () => {
    const broken = { state: "misconfigured" } as const;
    expect(stagingDecision(broken, "/staging-access", undefined, NOW)).toBe("unavailable");
    expect(stagingDecision(broken, "/", undefined, NOW)).toBe("unavailable");
  });

  it("sends pages and API routes without a cookie to the gate", () => {
    expect(stagingDecision(on, "/", undefined, NOW)).toBe("login");
    expect(stagingDecision(on, "/capture", undefined, NOW)).toBe("login");
    expect(stagingDecision(on, "/api/email/deliver", undefined, NOW)).toBe("login");
    expect(
      stagingDecision(on, "/updates/0b0d7a8e-0000-4000-8000-000000000000", undefined, NOW),
    ).toBe("login");
  });

  it("leaves the gate page, its form and the static files open", () => {
    expect(stagingDecision(on, "/staging-access", undefined, NOW)).toBe("allow");
    expect(stagingDecision(on, "/api/staging-access", undefined, NOW)).toBe("allow");
    expect(stagingDecision(on, "/_next/static/chunks/app.js", undefined, NOW)).toBe("allow");
    expect(stagingDecision(on, "/icons/icon-192.png", undefined, NOW)).toBe("allow");
  });

  it("does not let a path traversal pass as a static file", () => {
    expect(stagingDecision(on, "/_next/static/../../capture", undefined, NOW)).toBe("login");
    expect(stagingDecision(on, "/images/../api/email/deliver", undefined, NOW)).toBe("login");
  });

  it("allows a request that carries a valid session", () => {
    const token = issueStagingToken(PASSWORD, NOW);
    expect(stagingDecision(on, "/", token, NOW)).toBe("allow");
  });
});

describe("session token", () => {
  const token = issueStagingToken(PASSWORD, NOW);

  it("is valid until its expiry and not after", () => {
    expect(isValidStagingToken(token, PASSWORD, NOW)).toBe(true);
    expect(isValidStagingToken(token, PASSWORD, NOW + STAGING_GATE_MAX_AGE_SECONDS - 1)).toBe(true);
    expect(isValidStagingToken(token, PASSWORD, NOW + STAGING_GATE_MAX_AGE_SECONDS)).toBe(false);
  });

  it("is refused when the password changes, because the signature is keyed on it", () => {
    expect(isValidStagingToken(token, "a-different-testing-phrase", NOW)).toBe(false);
  });

  it("is refused when the expiry is changed", () => {
    const [, mac] = token.split(".");
    const later = NOW + 99_999;
    expect(isValidStagingToken(`${later}.${mac}`, PASSWORD, NOW)).toBe(false);
  });

  it("is refused when malformed, empty or missing", () => {
    expect(isValidStagingToken(undefined, PASSWORD, NOW)).toBe(false);
    expect(isValidStagingToken("", PASSWORD, NOW)).toBe(false);
    expect(isValidStagingToken("nodot", PASSWORD, NOW)).toBe(false);
    expect(isValidStagingToken(`${token}.extra`, PASSWORD, NOW)).toBe(false);
    expect(isValidStagingToken(`${NOW + 60}.`, PASSWORD, NOW)).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts only the exact password", () => {
    expect(passwordMatches(PASSWORD, PASSWORD)).toBe(true);
    expect(passwordMatches(`${PASSWORD} `, PASSWORD)).toBe(false);
    expect(passwordMatches("", PASSWORD)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a path inside the site, with its query", () => {
    expect(safeNextPath("/capture?seedling=1")).toBe("/capture?seedling=1");
  });

  it("sends anything that could leave the site back to the Home page", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
});
