import "server-only";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";
import { MESSAGES, type Messages } from "./messages";
import { createTranslator, type Translator } from "./translator";

/**
 * The language for this request, from the explicit choice, then the browser's preference, then English. It is
 * read from the request itself, so the first server render is already in the right language.
 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const requestHeaders = await headers();
  return resolveLocale(jar.get(LOCALE_COOKIE)?.value, requestHeaders.get("accept-language"));
}

/** The translator and dictionary for this request. Server components and server actions use this. */
export async function getTranslation(): Promise<{
  locale: Locale;
  t: Translator;
  messages: Messages;
}> {
  const locale = await getLocale();
  const messages = MESSAGES[locale];
  return { locale, t: createTranslator(messages), messages };
}
