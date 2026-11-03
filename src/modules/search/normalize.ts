/*
 * Query normalisation for Search. These functions mirror public.search_text and public.search_identifier in the
 * database, so the same query means the same thing on the page and in the SQL. Stored values are never changed.
 */

/** The longest query a visitor may search for. Longer input is refused, not cut short. */
export const SEARCH_QUERY_MAX = 80;

/** The most results shown in each group. The database enforces the same cap. */
export const SEARCH_RESULT_LIMIT = 12;

/**
 * Free text (working names, cultivar names, grower names): trims, collapses runs of whitespace and ignores
 * case. Punctuation is kept, so "Café au Lait" and "Cafe au Lait" are different words to the database.
 */
export function normalizeSearchText(input: string): string | null {
  const text = input.replace(/\s+/g, " ").trim().toLowerCase();
  return text === "" ? null : text;
}

/**
 * Human identifiers: trims, drops one leading "#" (so "#1" finds automatic number 1) and ignores case. Internal
 * punctuation is kept, so "JV-26-014" and "JV-26-41" stay distinct identifiers.
 */
export function normalizeSearchIdentifier(input: string): string | null {
  const text = input.trim().replace(/^#/, "").trim().toUpperCase();
  return text === "" ? null : text;
}
