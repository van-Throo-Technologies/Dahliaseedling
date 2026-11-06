import { describe, expect, it } from "vitest";
import { publicSurfaceActive, publicSurfaceDecision } from "./public-surface";

describe("the public surface switch", () => {
  it("is active only when PUBLIC_SURFACE is exactly invitations", () => {
    expect(publicSurfaceActive({ PUBLIC_SURFACE: "invitations" })).toBe(true);
    expect(publicSurfaceActive({ PUBLIC_SURFACE: "all" })).toBe(false);
    expect(publicSurfaceActive({ PUBLIC_SURFACE: "" })).toBe(false);
    expect(publicSurfaceActive({})).toBe(false);
  });
});

describe("the public surface paths", () => {
  it("allows the invitation journey, the legal pages and the health probe", () => {
    for (const path of [
      "/join",
      "/auth/confirm",
      "/auth/set-password",
      "/sign-in",
      "/legal/privacy",
      "/legal/terms",
      "/api/health",
    ]) {
      expect(publicSurfaceDecision(path)).toBe("allow");
    }
  });

  it("allows the static files those pages load", () => {
    expect(publicSurfaceDecision("/_next/static/chunks/app.js")).toBe("allow");
    expect(publicSurfaceDecision("/images/dahlia-founder.jpg")).toBe("allow");
    expect(publicSurfaceDecision("/icons/icon-192.png")).toBe("allow");
    expect(publicSurfaceDecision("/manifest.webmanifest")).toBe("allow");
  });

  it("sends the root to the invitation page", () => {
    expect(publicSurfaceDecision("/")).toBe("home");
  });

  it("refuses the administration, private and feed pages, and every API route outside the journey", () => {
    for (const path of [
      "/admin/invitations",
      "/admin/accounts",
      "/admin/reports",
      "/capture",
      "/profile",
      "/profile/edit",
      "/seedlings/123",
      "/search",
      "/api/email/deliver",
      "/api/account/export",
      "/privacy",
    ]) {
      expect(publicSurfaceDecision(path)).toBe("deny");
    }
  });

  it("ignores a trailing slash, but not a lookalike path", () => {
    expect(publicSurfaceDecision("/join/")).toBe("allow");
    expect(publicSurfaceDecision("/joined")).toBe("deny");
    expect(publicSurfaceDecision("/join-admin")).toBe("deny");
    expect(publicSurfaceDecision("/auth/confirmed")).toBe("deny");
  });

  it("refuses an encoded or traversal path rather than resolving it", () => {
    expect(publicSurfaceDecision("/%61dmin/invitations")).toBe("deny");
    expect(publicSurfaceDecision("/images/../capture")).toBe("deny");
  });
});
