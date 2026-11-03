import { describe, expect, it } from "vitest";
import { encodeCursor, readCursor } from "./cursor";

const ID = "11111111-2222-4333-8444-555555555555";
const binding = { query: "Wizard of Oz", country: "NL" };
const position = { tier: 3, sortText: "sunset surprise", id: ID };

describe("search cursors", () => {
  it("round-trips a position for the search it was issued for", () => {
    const cursor = encodeCursor(binding, position);
    expect(readCursor(cursor, binding)).toEqual({ ok: true, position });
  });

  it("is opaque and URL-safe", () => {
    expect(encodeCursor(binding, position)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("reads a missing cursor as the first page", () => {
    expect(readCursor(undefined, binding)).toEqual({ ok: true, position: null });
    expect(readCursor("", binding)).toEqual({ ok: true, position: null });
  });

  it("refuses a cursor issued for a different query, so it cannot move another search", () => {
    const cursor = encodeCursor(binding, position);
    expect(readCursor(cursor, { ...binding, query: "Dune" })).toEqual({ ok: false });
  });

  it("refuses a cursor issued for a different country, or for no country", () => {
    const cursor = encodeCursor(binding, position);
    expect(readCursor(cursor, { ...binding, country: "BE" })).toEqual({ ok: false });
    expect(readCursor(cursor, { ...binding, country: null })).toEqual({ ok: false });
  });

  it("treats the query as normalised, so case and spacing do not break a valid cursor", () => {
    const cursor = encodeCursor({ query: "  wizard   OF oz ", country: null }, position);
    expect(readCursor(cursor, { query: "Wizard of Oz", country: null })).toEqual({
      ok: true,
      position,
    });
  });

  it("refuses malformed input without throwing", () => {
    expect(readCursor("not a cursor!", binding)).toEqual({ ok: false });
    expect(readCursor("bm90IGpzb24", binding)).toEqual({ ok: false });
    expect(readCursor(Buffer.from("[1,2]").toString("base64url"), binding)).toEqual({ ok: false });
    expect(readCursor("a".repeat(601), binding)).toEqual({ ok: false });
  });

  it("refuses a tier, sort text or identifier outside what the database can return", () => {
    const withEnvelope = (value: Record<string, unknown>) =>
      Buffer.from(JSON.stringify({ q: "wizard of oz", c: "NL", ...value }), "utf8").toString(
        "base64url",
      );
    expect(readCursor(withEnvelope({ t: 9, s: "x", i: ID }), binding)).toEqual({ ok: false });
    expect(readCursor(withEnvelope({ t: 3, s: "x".repeat(201), i: ID }), binding)).toEqual({
      ok: false,
    });
    expect(readCursor(withEnvelope({ t: 3, s: "x", i: "not-a-uuid" }), binding)).toEqual({
      ok: false,
    });
  });
});
