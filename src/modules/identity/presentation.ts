import { strings } from "@/content/strings";
import { COUNTRIES } from "./country-codes";

/**
 * Where a profile's avatar is served from. The route checks the profile on every request, so
 * the address never bypasses suspension. Use it only when the profile has an avatar.
 */
export function avatarHref(profileId: string): string {
  return `/avatars/${profileId}`;
}

/** Display name for an ISO country code. Falls back to the code itself if it is unknown. */
export function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

/** "Member since October 2026", rendered in the app locale from a stored UTC timestamp. */
export function formatMemberSince(createdAt: string): string {
  const date = new Date(createdAt);
  const month = new Intl.DateTimeFormat(strings.locale, { month: "long", year: "numeric" }).format(
    date,
  );
  return `Member since ${month}`;
}
