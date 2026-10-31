/**
 * Validates a post-sign-in destination so an attacker cannot use `?next=` to send a user to
 * another site. Only same-site, absolute paths are accepted: "/" followed by a non-slash, non-backslash
 * character. Anything else falls back to the default.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Reject control characters, including tabs and newlines that browsers may strip.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
