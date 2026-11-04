import { describe, expect, it } from "vitest";
import { logEvent, sanitiseFields } from "./log";

describe("sanitiseFields", () => {
  it("keeps allowlisted codes, numbers and booleans", () => {
    expect(
      sanitiseFields({ outcome: "sent", count: 3, status: 200, route: "email.deliver" }),
    ).toEqual({
      outcome: "sent",
      count: 3,
      status: 200,
      route: "email.deliver",
    });
  });

  it("drops every field that is not on the allowlist", () => {
    expect(
      sanitiseFields({ body: "a private message", token: "abc", signedUrl: "https://x" }),
    ).toEqual({});
  });

  it("drops free text and anything that looks like an address, a token or a long string", () => {
    expect(sanitiseFields({ outcome: "Hello there, a private note" })).toEqual({});
    expect(sanitiseFields({ code: "grower@example.test" })).toEqual({});
    expect(sanitiseFields({ code: "x".repeat(65) })).toEqual({});
    expect(sanitiseFields({ count: Number.NaN })).toEqual({});
  });
});

describe("logEvent", () => {
  it("writes one JSON line with the event, a time and the safe fields only", () => {
    const lines: string[] = [];
    logEvent("info", "email_delivery_run", { outcome: "ok", count: 2, body: "secret" }, (line) =>
      lines.push(line),
    );
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry).toMatchObject({
      level: "info",
      event: "email_delivery_run",
      outcome: "ok",
      count: 2,
    });
    expect(entry).not.toHaveProperty("body");
    expect(typeof entry.at).toBe("string");
  });

  it("refuses an event name that is not a plain code", () => {
    const lines: string[] = [];
    logEvent("error", "failed for grower@example.test", {}, (line) => lines.push(line));
    expect(lines).toEqual([]);
  });
});
