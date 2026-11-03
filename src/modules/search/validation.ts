import { msg, type Msg } from "@/i18n/message";
import { COUNTRY_CODES, type CountryCode } from "@/modules/identity/country-codes";
import { SEARCH_QUERY_MAX } from "./normalize";

/** What the visitor asked for, after checks. Null means "not used". */
export interface SearchInput {
  readonly query: string | null;
  readonly country: CountryCode | null;
  /** Only Seedlings genuinely looking for a new grower. Canonical state, never a display label. */
  readonly available: boolean;
}

export type SearchValidation =
  | { readonly ok: true; readonly value: SearchInput }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, Msg>> };

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Checks the Search query string parameters. Input is only checked for shape and length here: the database
 * normalises it, and an unknown country code is refused rather than guessed at.
 */
export function validateSearch(params: {
  readonly q?: string | string[];
  readonly country?: string | string[];
  readonly available?: string | string[];
}): SearchValidation {
  const query = first(params.q).replace(/\s+/g, " ").trim();
  if (query.length > SEARCH_QUERY_MAX) {
    return {
      ok: false,
      fieldErrors: { q: msg("search.validation.tooLong", { max: SEARCH_QUERY_MAX }) },
    };
  }

  const country = first(params.country).trim().toUpperCase();
  if (country !== "" && !(COUNTRY_CODES as readonly string[]).includes(country)) {
    return { ok: false, fieldErrors: { country: msg("search.validation.country") } };
  }

  return {
    ok: true,
    value: {
      query: query === "" ? null : query,
      country: country === "" ? null : (country as CountryCode),
      available: first(params.available) === "1",
    },
  };
}
