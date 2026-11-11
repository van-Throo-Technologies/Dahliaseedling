import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  originOf,
  PERMISSIONS_POLICY,
  securityHeaders,
  TURNSTILE_ORIGIN,
} from "./headers";

const SUPABASE = "https://abcdefgh.supabase.co";

function directives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name!, values.join(" ")];
    }),
  );
}

describe("originOf", () => {
  it("returns the origin of a URL and nothing for a missing or invalid value", () => {
    expect(originOf("https://abcdefgh.supabase.co/rest/v1/")).toBe(SUPABASE);
    expect(originOf("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
    expect(originOf(undefined)).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});

describe("buildContentSecurityPolicy", () => {
  it("allows only this origin and the configured Supabase origin, and nothing by wildcard", () => {
    const policy = buildContentSecurityPolicy({ supabaseUrl: SUPABASE, development: false });
    expect(policy).not.toMatch(/\*/);
    const d = directives(policy);
    expect(d["default-src"]).toBe("'self'");
    expect(d["img-src"]).toContain(SUPABASE);
    expect(d["media-src"]).toContain(SUPABASE);
    expect(d["connect-src"]).toContain(SUPABASE);
    expect(d["connect-src"]).toContain("wss://abcdefgh.supabase.co");
  });

  it("refuses framing, plugins, foreign form targets and base-element changes", () => {
    const d = directives(buildContentSecurityPolicy({ supabaseUrl: SUPABASE, development: false }));
    expect(d["object-src"]).toBe("'none'");
    expect(d["frame-ancestors"]).toBe("'none'");
    expect(d["form-action"]).toBe("'self'");
    expect(d["base-uri"]).toBe("'self'");
  });

  it("allows no third-party script origin except the Turnstile bot check", () => {
    const d = directives(buildContentSecurityPolicy({ supabaseUrl: SUPABASE, development: false }));
    expect(d["script-src"]).not.toContain(SUPABASE);
    expect(d["script-src"]!.replace(TURNSTILE_ORIGIN, "")).not.toMatch(/https?:/);
    expect(d["script-src"]).toContain(TURNSTILE_ORIGIN);
  });

  it("frames and connects only to the Turnstile origin, not to any other third party", () => {
    const d = directives(buildContentSecurityPolicy({ supabaseUrl: SUPABASE, development: false }));
    expect(d["frame-src"]).toBe(TURNSTILE_ORIGIN);
    expect(d["connect-src"]!.replace(TURNSTILE_ORIGIN, "").replace(SUPABASE, "")).not.toMatch(
      /https?:/,
    );
  });

  it("allows eval and the development socket only in development", () => {
    const prod = directives(
      buildContentSecurityPolicy({ supabaseUrl: SUPABASE, development: false }),
    );
    const dev = directives(
      buildContentSecurityPolicy({ supabaseUrl: SUPABASE, development: true }),
    );
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["script-src"]).not.toContain("'wasm-unsafe-eval'");
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toContain("ws:");
  });

  it("still builds a valid policy when the Supabase URL is absent", () => {
    const d = directives(buildContentSecurityPolicy({ development: false }));
    expect(d["img-src"]).toBe("'self' blob: data:");
    expect(d["connect-src"]).toBe("'self' https://challenges.cloudflare.com");
  });
});

describe("securityHeaders", () => {
  it("sets the policy, permissions and framing headers, with HSTS only in production", () => {
    const prod = securityHeaders({ supabaseUrl: SUPABASE, development: false });
    const dev = securityHeaders({ supabaseUrl: SUPABASE, development: true });
    const keys = (list: { key: string }[]) => list.map((h) => h.key);
    expect(keys(prod)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
        "Strict-Transport-Security",
      ]),
    );
    expect(keys(dev)).not.toContain("Strict-Transport-Security");
    expect(prod.find((h) => h.key === "Permissions-Policy")?.value).toBe(PERMISSIONS_POLICY);
    expect(PERMISSIONS_POLICY).toContain("microphone=(self)");
  });
});
