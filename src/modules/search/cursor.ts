/*
 * Search continuation cursors. A cursor is the position of the last row a page showed, in the database's total
 * order (match tier, sort text, id). It is opaque to the interface: a base64url string that the page passes back
 * unchanged. Each cursor is bound to the query and country it was issued for, so a cursor from one search cannot
 * move another search, and a malformed or foreign cursor is refused rather than guessed at.
 *
 * A cursor carries only what is needed to resume: the normalised query, the country code, and the three ordering
 * values. None of it is private: the sort text is the public working name, cultivar name or display name.
 */

import { normalizeSearchText } from "./normalize";

/** The longest cursor accepted. Real cursors are far shorter; anything longer is refused before it is parsed. */
const CURSOR_MAX_LENGTH = 600;
const SORT_TEXT_MAX_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIERS = [1, 2, 3, 4, 5, 6] as const;

/** The position a continuation resumes after. */
export interface CursorPosition {
  readonly tier: number;
  readonly sortText: string;
  readonly id: string;
}

/** The search a cursor belongs to. */
export interface CursorBinding {
  readonly query: string | null;
  readonly country: string | null;
  /** The availability filter: a cursor from the filtered list cannot move the unfiltered one, or the reverse. */
  readonly available?: boolean;
  /** The seeds and seedheads filter: a cursor from the offers list cannot move a different filter's list. */
  readonly seeds?: boolean;
}

interface Envelope {
  readonly q: string;
  readonly c: string;
  readonly a: number;
  readonly g: number;
  readonly t: number;
  readonly s: string;
  readonly i: string;
}

/** The text a cursor is bound to: the normalised query, and the country code or nothing. */
function bindingKey(binding: CursorBinding): { q: string; c: string; a: number; g: number } {
  return {
    q: normalizeSearchText(binding.query ?? "") ?? "",
    c: binding.country ?? "",
    a: binding.available ? 1 : 0,
    g: binding.seeds ? 1 : 0,
  };
}

export function encodeCursor(binding: CursorBinding, position: CursorPosition): string {
  const envelope: Envelope = {
    ...bindingKey(binding),
    t: position.tier,
    s: position.sortText,
    i: position.id,
  };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export type CursorRead =
  { readonly ok: true; readonly position: CursorPosition | null } | { readonly ok: false };

/**
 * Reads a cursor for a search. Missing input means the first page. Anything that is not a cursor issued for this
 * exact query and country is refused, so the page can fall back to the first results and say so.
 */
export function readCursor(raw: string | undefined, binding: CursorBinding): CursorRead {
  if (raw === undefined || raw === "") return { ok: true, position: null };
  if (raw.length > CURSOR_MAX_LENGTH || !/^[A-Za-z0-9_-]+$/.test(raw)) return { ok: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return { ok: false };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false };
  const envelope = parsed as Partial<Record<keyof Envelope, unknown>>;

  const expected = bindingKey(binding);
  if (
    envelope.q !== expected.q ||
    envelope.c !== expected.c ||
    envelope.a !== expected.a ||
    envelope.g !== expected.g
  ) {
    return { ok: false };
  }
  if (typeof envelope.t !== "number" || !(TIERS as readonly number[]).includes(envelope.t)) {
    return { ok: false };
  }
  if (typeof envelope.s !== "string" || envelope.s.length > SORT_TEXT_MAX_LENGTH)
    return { ok: false };
  if (typeof envelope.i !== "string" || !UUID.test(envelope.i)) return { ok: false };

  return { ok: true, position: { tier: envelope.t, sortText: envelope.s, id: envelope.i } };
}
