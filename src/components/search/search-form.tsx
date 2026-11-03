import Link from "next/link";
import { formatCountry } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { COUNTRY_CODES, type CountryCode } from "@/modules/identity/country-codes";

/**
 * The Search box on Home. It is a plain GET form, so it works without JavaScript and the address carries the
 * state: back, forward and refresh behave. The field and its button share one row, so Search stays a compact
 * entry above the Feed rather than a block that pushes the photos down. Countries are listed by their name in the
 * reader's language, sorted in that language, and submitted as their ISO code.
 */
export async function SearchForm({
  query,
  country,
}: {
  readonly query: string | null;
  readonly country: CountryCode | null;
}) {
  const { t, locale } = await getTranslation();
  const collator = new Intl.Collator(locale);
  const countries = COUNTRY_CODES.map((code) => ({ code, name: formatCountry(code, locale) })).sort(
    (a, b) => collator.compare(a.name, b.name),
  );
  const active = query !== null || country !== null;

  return (
    <form role="search" method="get" action="/" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="search-q" className="text-sm font-medium text-text">
          {t("search.label")}
        </label>
        <div className="flex gap-2">
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={query ?? ""}
            placeholder={t("search.placeholder")}
            aria-describedby="search-help"
            autoComplete="off"
            maxLength={80}
            className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-base text-text"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-control bg-primary px-4 text-base font-medium text-on-primary"
          >
            {t("search.submit")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="search-country" className="text-sm font-medium text-text">
            {t("search.country")}
          </label>
          <select
            id="search-country"
            name="country"
            defaultValue={country ?? ""}
            className="min-h-11 max-w-full rounded-control border border-border bg-surface px-3 text-base text-text"
          >
            <option value="">{t("search.anyCountry")}</option>
            {countries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        {active ? (
          <Link href="/" className="inline-flex min-h-11 items-center text-base text-text-brand">
            {t("search.clear")}
          </Link>
        ) : null}
      </div>

      <p id="search-help" className="text-sm text-text-muted">
        {t("search.help")}
      </p>
    </form>
  );
}
