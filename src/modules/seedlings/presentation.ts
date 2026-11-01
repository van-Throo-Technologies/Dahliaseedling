/** Example of what a Series pattern produces this year, for display only. */
export function patternExample(pattern: string, now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  return pattern.replace("{YY}", yy).replace("{NNN}", "001");
}

/** Human label for a parentage role. */
export function roleLabel(role: "seed_parent" | "pollen_parent"): string {
  return role === "seed_parent" ? "Seed parent" : "Pollen parent";
}

/** Human label for a visibility value. */
export function visibilityLabel(visibility: "private" | "public"): string {
  return visibility === "public" ? "Public" : "Private";
}

/** "14 October 2026", in the app locale, from a stored UTC timestamp. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** True when a Series pattern contains the year token. Such identifiers need a first-grown year. */
export function patternUsesYear(pattern: string): boolean {
  return pattern.includes("{YY}");
}
