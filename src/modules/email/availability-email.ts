import { MESSAGES, type Messages } from "@/i18n/messages";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { createTranslator } from "@/i18n/translator";

/*
 * The availability email: subject, plain text and a simple HTML body, in the grower's language. The renderer receives only the
 * locale, the Seedling's working name, the Seedling identifier and the application's base URL. It never receives an address, a
 * private field, another Seedling, or any recommendation, so none of those can reach the message.
 */

export interface AvailabilityEmailInput {
  readonly locale: string;
  /** The Seedling's working name, or null when it has none. It is shown exactly as stored. */
  readonly seedlingName: string | null;
  readonly seedlingId: string;
  readonly baseUrl: string;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** An unknown or missing language falls back to English, the application's default. */
export function localeOrDefault(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** The page the grower came from. The identifier is a UUID, so the path cannot carry anything else. */
export function seedlingUrl(baseUrl: string, seedlingId: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/seedlings/${seedlingId}`;
}

export function renderAvailabilityEmail(input: AvailabilityEmailInput): RenderedEmail {
  const locale = localeOrDefault(input.locale);
  const t = createTranslator(MESSAGES[locale] as Messages);
  const url = seedlingUrl(input.baseUrl, input.seedlingId);
  const body = input.seedlingName
    ? t("email.availability.body", { name: input.seedlingName })
    : t("email.availability.bodyUnnamed");
  const subject = t("email.availability.subject");
  const open = t("email.availability.open");
  const stop = t("email.availability.stopHint");

  const text = [body, "", `${open}: ${url}`, "", stop].join("\n");
  const html = [
    "<!doctype html>",
    `<html lang="${locale}">`,
    "<body>",
    `<p>${escapeHtml(body)}</p>`,
    `<p><a href="${escapeHtml(url)}">${escapeHtml(open)}</a></p>`,
    `<p>${escapeHtml(stop)}</p>`,
    "</body>",
    "</html>",
  ].join("\n");
  return { subject, text, html };
}
