"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setLocaleAction } from "@/i18n/actions";
import { LOCALE_NAMES, LOCALES } from "@/i18n/locales";
import { useLocale, useT } from "@/i18n/client";

/**
 * A plain language choice. Each language is named in its own language. Changing it keeps you on the same page,
 * including its search or filter, because the query string is part of where the visitor is. The address never
 * carries a language. Without JavaScript the apply button submits the choice.
 */
export function LanguageSelector() {
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const returnTo = search ? `${pathname}?${search}` : pathname;

  return (
    <form action={setLocaleAction} className="flex items-center">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="language-select" className="sr-only">
        {t("app.language.label")}
      </label>
      <select
        id="language-select"
        name="locale"
        defaultValue={locale}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="min-h-11 max-w-[7.5rem] rounded-control border border-border bg-surface px-2 text-sm text-text-brand"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
      <button type="submit" className="sr-only">
        {t("app.language.label")}
      </button>
    </form>
  );
}
