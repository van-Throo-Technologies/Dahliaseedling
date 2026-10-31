import { describe, expect, it } from "vitest";
import { ConfigError, parseAppConfig } from "./env";

const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
};

describe("parseAppConfig", () => {
  it("returns typed configuration when required values are present", () => {
    expect(parseAppConfig(validEnv)).toEqual({
      supabaseUrl: "http://127.0.0.1:54321",
      supabasePublishableKey: "test-publishable-key",
    });
  });

  it("names every missing required variable and never includes values", () => {
    try {
      parseAppConfig({});
      expect.unreachable("expected parseAppConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      if (!(error instanceof ConfigError)) return;
      expect(error.problems.missing).toEqual([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      ]);
      expect(error.problems.invalid).toEqual([]);
      expect(error.message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });

  it("treats blank values as missing", () => {
    expect(() =>
      parseAppConfig({ ...validEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "   " }),
    ).toThrow(ConfigError);
  });

  it("rejects a Supabase URL that is not an http(s) URL", () => {
    try {
      parseAppConfig({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: "not a url" });
      expect.unreachable("expected parseAppConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      if (!(error instanceof ConfigError)) return;
      expect(error.problems.invalid).toEqual(["NEXT_PUBLIC_SUPABASE_URL"]);
    }
  });
});
