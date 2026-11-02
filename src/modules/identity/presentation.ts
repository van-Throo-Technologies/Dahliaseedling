import { formatCountry, formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { COUNTRY_CODES } from "./country-codes";

/**
 * Where a profile's avatar is served from. The route checks the profile on every request, so
 * the address never bypasses suspension. Use it only when the profile has an avatar.
 */
export function avatarHref(profileId: string): string {
  return `/avatars/${profileId}`;
}

/** Display name for an ISO country code, in the interface language. The stored code is unchanged. */
export function countryName(code: string, locale: Locale): string {
  return COUNTRY_CODES.some((known) => known === code.toUpperCase())
    ? formatCountry(code, locale)
    : code;
}

/** The month and year a profile was created, in the interface language, from a stored UTC timestamp. */
export function formatMemberSinceMonth(createdAt: string, locale: Locale): string {
  return formatDate(createdAt, locale, { day: undefined, month: "long", year: "numeric" });
}
