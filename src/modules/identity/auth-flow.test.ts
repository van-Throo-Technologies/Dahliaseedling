import { describe, expect, it } from "vitest";
import {
  confirmFailureFrom,
  confirmTypeFrom,
  destinationAfterConfirm,
  signUpRefusalFrom,
  tokenHashFrom,
} from "./auth-flow";

const TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";

describe("confirmation link parameters", () => {
  it("accepts only the sign-up and invitation link types", () => {
    expect(confirmTypeFrom("signup")).toBe("signup");
    expect(confirmTypeFrom("invite")).toBe("invite");
    expect(confirmTypeFrom("recovery")).toBeNull();
    expect(confirmTypeFrom("email_change")).toBeNull();
    expect(confirmTypeFrom("")).toBeNull();
    expect(confirmTypeFrom(null)).toBeNull();
  });

  it("accepts a URL-safe token hash and refuses anything else before it reaches the auth server", () => {
    expect(tokenHashFrom(TOKEN)).toBe(TOKEN);
    expect(tokenHashFrom("short")).toBeNull();
    expect(tokenHashFrom(`${TOKEN}/../../admin`)).toBeNull();
    expect(tokenHashFrom(`${TOKEN} `)).toBeNull();
    expect(tokenHashFrom("x".repeat(257))).toBeNull();
    expect(tokenHashFrom(null)).toBeNull();
  });
});

describe("failure codes", () => {
  it("reports an expired or already used link as expired, and anything else as invalid", () => {
    expect(confirmFailureFrom("otp_expired")).toBe("expired");
    expect(confirmFailureFrom("validation_failed")).toBe("invalid");
    expect(confirmFailureFrom(undefined)).toBe("invalid");
  });

  it("names the global sign-up switch separately from other sign-up refusals", () => {
    expect(signUpRefusalFrom("signup_disabled")).toBe("invitationOnly");
    expect(signUpRefusalFrom("weak_password")).toBe("generic");
    expect(signUpRefusalFrom(undefined)).toBe("generic");
  });
});

describe("where a confirmed visitor goes", () => {
  it("sends an invited visitor to set a password, keeping the requested path", () => {
    expect(destinationAfterConfirm({ type: "invite", next: "/capture", hasProfile: false })).toBe(
      "/auth/set-password?next=%2Fcapture",
    );
  });

  it("sends a confirmed sign-up without a profile to profile setup, with a confirmation notice", () => {
    expect(destinationAfterConfirm({ type: "signup", next: null, hasProfile: false })).toBe(
      "/profile/setup?next=%2F&confirmed=1",
    );
  });

  it("sends a confirmed sign-up that already has a profile to the requested path", () => {
    expect(destinationAfterConfirm({ type: "signup", next: "/capture", hasProfile: true })).toBe(
      "/capture",
    );
  });

  it("refuses off-site and malformed destinations and falls back to the home page", () => {
    const unsafe = [
      "https://evil.example/steal",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/ok\r\nSet-Cookie: x=1",
    ];
    for (const next of unsafe) {
      const destination = destinationAfterConfirm({ type: "signup", next, hasProfile: true });
      expect(destination).toBe("/");
    }
  });

  it("never lets an unsafe destination reach the invitation path either", () => {
    const destination = destinationAfterConfirm({
      type: "invite",
      next: "//evil.example",
      hasProfile: false,
    });
    expect(destination).toBe("/auth/set-password?next=%2F");
  });
});
