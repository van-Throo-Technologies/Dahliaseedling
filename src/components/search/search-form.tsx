import Link from "next/link";
import { formatCountry } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { COUNTRY_CODES, type CountryCode } from "@/modules/identity/country-codes";

/**
 * The Search entry on Home. It is a plain GET form, so it works without JavaScript and the address carries the state: back, forward
 * and refresh behave. The field and its button share one row. The filters sit in a disclosure beneath it, closed by default and opened
 * when a filter is already in use, so the photographs stay the first thing on the page. Countries are listed by their name in the
 * reader's language, sorted in that language, and submitted as their ISO code.
 */
export async function SearchForm({
  query,
  country,
  available = false,
  seeds = false,
}: {
  readonly query: string | null;
  readonly country: CountryCode | null;
  readonly available?: boolean;
  readonly seeds?: boolean;
}) {
  const { t, locale } = await getTranslation();
  const collator = new Intl.Collator(locale);
  const countries = COUNTRY_CODES.map((code) => ({ code, name: formatCountry(code, locale) })).sort(
    (a, b) => collator.compare(a.name, b.name),
  );
  const active = query !== null || country !== null || available || seeds;
  const filtering = country !== null || available || seeds;

  return (
    <form role="search" method="get" action="/" className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label htmlFor="search-q" className="sr-only">
          {t("search.label")}
        </label>
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

      <details open={filtering} className="rounded-control border border-border bg-surface px-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-medium text-text-brand">
          {t("search.filters")}
        </summary>
        <div className="flex flex-col gap-4 pb-4 pt-1">
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
          <div className="flex flex-col gap-1">
            <label className="inline-flex min-h-11 items-center gap-3 text-base text-text">
              <input
                type="checkbox"
                name="available"
                value="1"
                defaultChecked={available}
                className="h-6 w-6 shrink-0 accent-[var(--color-text-brand)]"
              />
              <span>{t("search.availableLabel")}</span>
            </label>
            <p className="text-sm text-text-muted">{t("search.availableHint")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="inline-flex min-h-11 items-center gap-3 text-base text-text">
              <input
                type="checkbox"
                name="seeds"
                value="1"
                defaultChecked={seeds}
                className="h-6 w-6 shrink-0 accent-[var(--color-text-brand)]"
              />
              <span>{t("search.seedsLabel")}</span>
            </label>
            <p className="text-sm text-text-muted">{t("search.seedsHint")}</p>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="search-help" className="text-sm text-text-muted">
          {t("search.help")}
        </p>
        {active ? (
          <Link href="/" className="inline-flex min-h-11 items-center text-base text-text-brand">
            {t("search.clear")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
