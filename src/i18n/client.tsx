"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./locales";
import type { Messages } from "./messages";
import { createTranslator, type Translator } from "./translator";

interface LocaleContextValue {
  readonly locale: Locale;
  readonly messages: Messages;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Gives client components the language decided on the server. Only the active language's dictionary is passed
 * down, so each language's text is the only text the browser receives.
 */
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useT and useLocale must be used inside LocaleProvider.");
  return value;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useT(): Translator {
  const { messages } = useLocaleContext();
  return useMemo(() => createTranslator(messages), [messages]);
}
