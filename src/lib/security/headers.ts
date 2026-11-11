/*
 * Security response headers, built in one place so they can be tested. The policy allows only this origin and the configured Supabase
 * origin, which serves storage and the API. Nothing else is loaded, framed or posted to.
 *
 * Known limit: Next.js App Router needs inline bootstrap scripts, so script-src allows 'unsafe-inline'. That still blocks scripts
 * from other origins, framing and plugins, but it does not stop an injected inline script. Removing 'unsafe-inline' needs per-request
 * nonces in the proxy, which is a separate decision.
 */

export interface HeaderInput {
  readonly supabaseUrl?: string;
  readonly development: boolean;
}

/** The origin of a URL, or null when the value is missing or is not a URL. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/*
 * Cloudflare Turnstile, the bot check on the sign-up, sign-in and password-reset forms. Its script and challenge frame come only from this
 * origin, and nothing else is added. It is the one third-party origin the policy allows.
 */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export function buildContentSecurityPolicy(input: HeaderInput): string {
  const supabase = originOf(input.supabaseUrl);
  const supabaseSocket = supabase ? supabase.replace(/^http/, "ws") : null;
  const list = (...sources: (string | null)[]) => sources.filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    `script-src ${list("'self'", "'unsafe-inline'", TURNSTILE_ORIGIN, input.development ? "'unsafe-eval'" : null)}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${list("'self'", "blob:", "data:", supabase)}`,
    "font-src 'self' data:",
    `media-src ${list("'self'", "blob:", supabase)}`,
    `connect-src ${list("'self'", supabase, supabaseSocket, TURNSTILE_ORIGIN, input.development ? "ws:" : null)}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Camera and microphone are allowed only for this origin, which the voice note and photo capture need. Everything else is off. */
export const PERMISSIONS_POLICY =
  "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()";

export function securityHeaders(input: HeaderInput): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(input) },
  ];
  if (!input.development) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
  }
  return headers;
}
