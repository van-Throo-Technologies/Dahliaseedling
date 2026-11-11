import { describe, expect, it } from "vitest";
import { selfRegistrationOpen } from "./registration";

describe("selfRegistrationOpen", () => {
  it("is closed in a production deployment built from main", () => {
    expect(selfRegistrationOpen({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })).toBe(
      false,
    );
  });

  it("is closed in a production deployment from any other branch", () => {
    expect(
      selfRegistrationOpen({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "release-x" }),
    ).toBe(false);
    expect(
      selfRegistrationOpen({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "staging" }),
    ).toBe(false);
  });

  it("is closed in a production deployment that reports no branch", () => {
    expect(selfRegistrationOpen({ VERCEL_ENV: "production" })).toBe(false);
  });

  it("stays open in a preview deployment, from main or any other branch", () => {
    expect(selfRegistrationOpen({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "main" })).toBe(
      true,
    );
    expect(selfRegistrationOpen({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature" })).toBe(
      true,
    );
  });

  it("stays open locally, where no deployment variable is set", () => {
    expect(selfRegistrationOpen({})).toBe(true);
  });

  it("is not reopened by any public-surface setting in production", () => {
    expect(selfRegistrationOpen({ VERCEL_ENV: "production", PUBLIC_SURFACE: "invitations" })).toBe(
      false,
    );
  });
});
