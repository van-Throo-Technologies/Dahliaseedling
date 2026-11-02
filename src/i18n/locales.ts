/*
 * The supported interface languages. Adding a language means adding a dictionary and a name here; routes,
 * stored data and URLs do not change with the language.
 */
export const LOCALES = ["en", "nl", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

/** English is the fallback for every unsupported or unknown language. */
export const DEFAULT_LOCALE: Locale = "en";

/** The cookie that stores an explicit choice. It is read on the server, so the first render is already right. */
export const LOCALE_COOKIE = "dahlia_locale";

/** Each language is named in its own language, so a visitor can find theirs whatever the current one is. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  fr: "Français",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the best supported language from an Accept-Language header. Quality weights are honoured, and a regional
 * tag such as nl-BE counts as nl. Anything unsupported falls back to English.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return {
        language: tag.trim().toLowerCase().split("-")[0] ?? "",
        weight: quality ? Number(quality.slice(2)) : 1,
      };
    })
    .filter(
      (entry) => entry.language.length > 0 && Number.isFinite(entry.weight) && entry.weight > 0,
    )
    .sort((a, b) => b.weight - a.weight);
  for (const { language } of ranked) {
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}

/**
 * The precedence, highest first: an explicit choice saved by the visitor or grower; the browser's language
 * preference; English. Nothing else (profile country, IP address, Seedling country) influences the language.
 */
export function resolveLocale(
  explicitChoice: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(explicitChoice)) return explicitChoice;
  return negotiateLocale(acceptLanguage);
}
