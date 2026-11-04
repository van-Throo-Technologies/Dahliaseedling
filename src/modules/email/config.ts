import "server-only";

/*
 * Server-only email configuration. Every value is read here and nowhere else, and no value is ever echoed back. A missing value
 * is reported by name, so a deployment can be fixed without exposing a secret. None of these names uses NEXT_PUBLIC_.
 */

export interface EmailConfig {
  readonly resendApiKey: string;
  readonly fromAddress: string;
  readonly appBaseUrl: string;
}

export class EmailConfigError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`Email is not configured: missing ${missing.join(", ")}.`);
    this.name = "EmailConfigError";
  }
}

const FROM_PATTERN = /^(?:[^<>\n]+<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/;

export function readEmailConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EmailConfig {
  const resendApiKey = env.RESEND_API_KEY?.trim() ?? "";
  const fromAddress = env.EMAIL_FROM_ADDRESS?.trim() ?? "";
  const appBaseUrl = env.APP_BASE_URL?.trim() ?? "";
  const missing: string[] = [];
  if (!resendApiKey) missing.push("RESEND_API_KEY");
  if (!FROM_PATTERN.test(fromAddress)) missing.push("EMAIL_FROM_ADDRESS");
  let baseUrlOk = false;
  try {
    const url = new URL(appBaseUrl);
    baseUrlOk =
      url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    baseUrlOk = false;
  }
  if (!baseUrlOk) missing.push("APP_BASE_URL");
  if (missing.length > 0) throw new EmailConfigError(missing);
  return { resendApiKey, fromAddress, appBaseUrl: appBaseUrl.replace(/\/+$/, "") };
}
