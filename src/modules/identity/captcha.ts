/*
 * The bot check on the sign-up, sign-in and password-reset forms. Cloudflare Turnstile produces a token in the browser. The server passes it
 * to Supabase Auth, which verifies it with the secret key that is kept in the Supabase dashboard, never in this application. Supabase's own
 * CAPTCHA setting enforces the check on every auth request, so a direct call without a valid token is refused too.
 *
 * The application requires a token whenever the public site key is configured. Without the key, as in local development and the automated
 * tests, the forms show no challenge and no token is sent.
 */

export const CAPTCHA_FIELD = "cf-turnstile-response";

/** True when the Turnstile site key is configured, so the forms carry a challenge and the server requires its token. */
export function captchaRequired(env: Readonly<Record<string, string | undefined>>): boolean {
  return Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());
}

/** Longest token the application will forward. Turnstile tokens are far shorter, so a longer value is not a token. */
export const CAPTCHA_TOKEN_MAX_LENGTH = 2048;

/** The token the form submitted, or undefined when the form has none or the value is not a plausible token. */
export function captchaTokenFrom(formData: FormData): string | undefined {
  const token = formData.get(CAPTCHA_FIELD);
  if (typeof token !== "string") return undefined;
  const trimmed = token.trim();
  return trimmed !== "" && trimmed.length <= CAPTCHA_TOKEN_MAX_LENGTH ? trimmed : undefined;
}

/** Supabase reports a token that is missing, expired, reused or invalid with the code captcha_failed. */
export function captchaFailedFrom(code: string | undefined): boolean {
  return code === "captcha_failed";
}
