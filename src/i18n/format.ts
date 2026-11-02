import type { Locale } from "./locales";

/** Replaces {name} placeholders. Values are inserted as plain text, never as markup. */
export function interpolate(
  template: string,
  values?: Readonly<Record<string, string | number>>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/** Locale-aware presentation helpers. They change how a value looks, never what is stored. */
export function formatDate(
  iso: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * A country's name in the interface language, from its canonical ISO code. The code is what is stored and
 * filtered on; the name is display only.
 */
export function formatCountry(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
