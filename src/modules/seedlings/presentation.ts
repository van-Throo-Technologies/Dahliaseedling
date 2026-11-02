/*
 * Language-neutral presentation for Seedlings. Labels and dates are translated where they are shown, through the
 * translator and the locale-aware formatters in src/i18n. Stored values (such as "private") are never displayed raw.
 */

/** Example of what a Series pattern produces this year, for display only. */
export function patternExample(pattern: string, now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  return pattern.replace("{YY}", yy).replace("{NNN}", "001");
}

/** True when a Series pattern contains the year token. Such identifiers need a first-grown year. */
export function patternUsesYear(pattern: string): boolean {
  return pattern.includes("{YY}");
}
