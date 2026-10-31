import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./status";

const now = new Date("2026-10-31T12:00:00.000Z");

describe("getHealthStatus", () => {
  it("responds 200 with a structured ok body when configuration is present", () => {
    const result = getHealthStatus(
      {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      },
      now,
    );

    expect(result).toEqual({
      httpStatus: 200,
      body: {
        status: "ok",
        service: "dahliaseedling",
        checkedAt: "2026-10-31T12:00:00.000Z",
        checks: { configuration: "ok" },
      },
    });
  });

  it("responds 503 and names missing variables when configuration is absent", () => {
    const result = getHealthStatus({}, now);

    expect(result.httpStatus).toBe(503);
    expect(result.body).toEqual({
      status: "error",
      service: "dahliaseedling",
      checkedAt: "2026-10-31T12:00:00.000Z",
      checks: { configuration: "error" },
      problems: {
        missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
        invalid: [],
      },
    });
  });

  it("never echoes configuration values into the response body", () => {
    const secretLikeValue = "sb_publishable_should_never_appear";
    const result = getHealthStatus(
      {
        NEXT_PUBLIC_SUPABASE_URL: "not a url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretLikeValue,
      },
      now,
    );

    expect(JSON.stringify(result.body)).not.toContain(secretLikeValue);
    expect(JSON.stringify(result.body)).not.toContain("not a url");
  });
});
