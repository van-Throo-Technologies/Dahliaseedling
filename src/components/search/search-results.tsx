import Link from "next/link";
import { PublicPhoto } from "@/components/publications/public-photo";
import { FormMessage } from "@/design-system/components/form-message";
import { formatCount, formatCountry } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";
import { getTranslation } from "@/i18n/server";
import type { MessageKey, Translator } from "@/i18n/translator";
import { countryName } from "@/modules/identity/presentation";
import { labelWords, type LabelWords } from "@/modules/seedlings/labels";
import type {
  CultivarResult,
  GrowerResult,
  SearchResults,
  SeedlingReason,
  SeedlingResult,
} from "@/modules/search/repository";

/*
 * Grouped results for an active search. Each result links to its canonical page: a Seedling, a grower's profile,
 * or the search for a cultivar name, which lists the seedlings that record it. Names and identifiers are shown
 * exactly as stored; only the words around them are translated.
 *
 * Each group pages on its own. "Show more" moves one group to its next page and keeps every other group where it
 * is, so continuing the seedlings never resets the growers or the cultivars.
 */

const REASON_KEY: Record<SeedlingReason, MessageKey> = {
  identifier: "search.reason.identifier",
  working_name: "search.reason.workingName",
  parent_cultivar: "search.reason.parentCultivar",
  parent_seedling: "search.reason.parentSeedling",
  country: "search.reason.country",
};

const CONTROL =
  "inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand";

function identifierLabel(result: SeedlingResult, words: LabelWords): string {
  if (!result.primaryIdentifier) return result.workingName ?? words.seedling;
  return result.primaryKind === "automatic"
    ? words.automatic(result.primaryIdentifier)
    : result.primaryIdentifier;
}

function accountTypeText(value: string | null, t: Translator): string | null {
  switch (value) {
    case "individual":
      return t("identity.fields.accountTypeIndividual");
    case "breeder":
      return t("identity.fields.accountTypeBreeder");
    case "farm":
      return t("identity.fields.accountTypeFarm");
    default:
      return null;
  }
}

/**
 * The address of a search with the given cursors. Each group keeps its own cursor, so the address for one group's
 * next page carries the others' current positions unchanged. Empty values are left out.
 */
function searchHref(state: {
  readonly query: string | null;
  readonly country: string | null;
  readonly seedlings: string | null;
  readonly cultivars: string | null;
  readonly growers: string | null;
}): string {
  const params = new URLSearchParams();
  if (state.query !== null) params.set("q", state.query);
  if (state.country) params.set("country", state.country);
  if (state.seedlings) params.set("seedlings", state.seedlings);
  if (state.cultivars) params.set("cultivars", state.cultivars);
  if (state.growers) params.set("growers", state.growers);
  const text = params.toString();
  return text ? `/?${text}` : "/";
}

function SeedlingCard({
  result,
  words,
  t,
  locale,
}: {
  readonly result: SeedlingResult;
  readonly words: LabelWords;
  readonly t: Translator;
  readonly locale: Locale;
}) {
  const label = identifierLabel(result, words);
  return (
    <li>
      <Link
        href={`/seedlings/${result.seedlingId}`}
        className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-3 text-text no-underline"
      >
        {result.cover ? (
          <PublicPhoto image={result.cover} alt={label} />
        ) : (
          <div className="flex min-h-24 items-center rounded-surface bg-background p-4 text-sm text-text-muted">
            {t("search.seedling.noImage")}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-base font-medium text-text-brand">{label}</span>
          {result.workingName && result.primaryIdentifier ? (
            <span className="text-base text-text">{result.workingName}</span>
          ) : null}
          <span className="text-sm text-text-muted">
            {t("search.seedling.grownBy", { name: result.holderName })}
            {" · "}
            {countryName(result.holderCountry, locale)}
          </span>
          <span className="text-sm text-text-muted">{t(REASON_KEY[result.reason])}</span>
        </div>
      </Link>
    </li>
  );
}

function CultivarCard({
  result,
  t,
  locale,
}: {
  readonly result: CultivarResult;
  readonly t: Translator;
  readonly locale: Locale;
}) {
  const parentage: string[] = [];
  if (result.seedParentCount > 0) {
    parentage.push(
      result.seedParentCount === 1
        ? t("search.cultivar.seedParentOne")
        : t("search.cultivar.seedParentMany", {
            count: formatCount(result.seedParentCount, locale),
          }),
    );
  }
  if (result.pollenParentCount > 0) {
    parentage.push(
      result.pollenParentCount === 1
        ? t("search.cultivar.pollenParentOne")
        : t("search.cultivar.pollenParentMany", {
            count: formatCount(result.pollenParentCount, locale),
          }),
    );
  }
  return (
    <li>
      <Link
        href={`/?q=${encodeURIComponent(result.name)}`}
        className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-4 text-text no-underline"
      >
        <span className="text-lg font-medium text-text-brand">{result.name}</span>
        {parentage.length > 0 ? (
          parentage.map((line) => (
            <span key={line} className="text-sm text-text-muted">
              {line}
            </span>
          ))
        ) : (
          <span className="text-sm text-text-muted">{t("search.cultivar.none")}</span>
        )}
        <span className="text-sm font-medium text-text-brand">
          {t("search.cultivar.findSeedlings")}
        </span>
      </Link>
    </li>
  );
}

function GrowerCard({
  result,
  t,
  locale,
}: {
  readonly result: GrowerResult;
  readonly t: Translator;
  readonly locale: Locale;
}) {
  const type = accountTypeText(result.accountType, t);
  return (
    <li>
      <Link
        href={`/profiles/${result.profileId}`}
        className="flex flex-col gap-1 rounded-surface border border-border bg-surface p-4 text-text no-underline"
      >
        <span className="text-lg font-medium text-text-brand">{result.displayName}</span>
        <span className="text-sm text-text-muted">
          {countryName(result.countryCode, locale)}
          {type ? ` · ${type}` : ""}
        </span>
        <span className="text-sm font-medium text-text-brand">{t("search.grower.open")}</span>
      </Link>
    </li>
  );
}

/** The continuation controls of one group: the next page, and a way back to its first page. */
function GroupPager({
  next,
  first,
  label,
  t,
}: {
  readonly next: string | null;
  readonly first: string | null;
  readonly label: string;
  readonly t: Translator;
}) {
  if (!next && !first) return null;
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {next ? (
          <li>
            <Link href={next} className={CONTROL}>
              {label}
            </Link>
          </li>
        ) : null}
        {first ? (
          <li>
            <Link href={first} className={CONTROL}>
              {t("search.first")}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export async function SearchResultsView({
  results,
  query,
  country,
}: {
  readonly results: SearchResults;
  readonly query: string | null;
  readonly country: string | null;
}) {
  const { t, locale } = await getTranslation();
  const words = labelWords(t);

  if (results.failed) {
    return <FormMessage tone="error">{t("errors.searchFailed")}</FormMessage>;
  }

  const seedlings = results.seedlings.items;
  const cultivars = results.cultivars.items;
  const growers = results.growers.items;
  const total = seedlings.length + cultivars.length + growers.length;
  const headline =
    query !== null
      ? t("search.resultsFor", { query })
      : t("search.resultsInCountry", { country: formatCountry(country ?? "", locale) });

  // The cursors each group is on now, so a link for one group keeps the others where they are.
  const here = {
    query,
    country,
    seedlings: results.seedlings.current,
    cultivars: results.cultivars.current,
    growers: results.growers.current,
  };
  const seedlingsNext = results.seedlings.next
    ? searchHref({ ...here, seedlings: results.seedlings.next })
    : null;
  const seedlingsFirst = results.seedlings.current
    ? searchHref({ ...here, seedlings: null })
    : null;
  const cultivarsNext = results.cultivars.next
    ? searchHref({ ...here, cultivars: results.cultivars.next })
    : null;
  const cultivarsFirst = results.cultivars.current
    ? searchHref({ ...here, cultivars: null })
    : null;
  const growersNext = results.growers.next
    ? searchHref({ ...here, growers: results.growers.next })
    : null;
  const growersFirst = results.growers.current ? searchHref({ ...here, growers: null }) : null;

  return (
    <div className="flex flex-col gap-8" aria-live="polite">
      <h2 className="text-lg font-medium text-text">{headline}</h2>

      {results.invalidCursor ? (
        <FormMessage tone="error">{t("search.cursorInvalid")}</FormMessage>
      ) : null}

      {total === 0 ? (
        <section
          aria-labelledby="search-empty-title"
          className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-4"
        >
          <h3 id="search-empty-title" className="text-lg font-medium text-text">
            {t("search.empty.title")}
          </h3>
          <p className="text-base text-text-muted">{t("search.empty.text")}</p>
        </section>
      ) : null}

      {seedlings.length > 0 || results.seedlings.current ? (
        <section aria-labelledby="group-seedlings" className="flex flex-col gap-3">
          <h3 id="group-seedlings" className="text-lg font-medium text-text">
            {t("search.groups.seedlings")}
          </h3>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {seedlings.map((result) => (
              <SeedlingCard
                key={result.seedlingId}
                result={result}
                words={words}
                t={t}
                locale={locale}
              />
            ))}
          </ul>
          <GroupPager
            next={seedlingsNext}
            first={seedlingsFirst}
            label={t("search.more.seedlings")}
            t={t}
          />
        </section>
      ) : null}

      {cultivars.length > 0 || results.cultivars.current ? (
        <section aria-labelledby="group-cultivars" className="flex flex-col gap-3">
          <h3 id="group-cultivars" className="text-lg font-medium text-text">
            {t("search.groups.cultivars")}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cultivars.map((result) => (
              <CultivarCard key={result.cultivarId} result={result} t={t} locale={locale} />
            ))}
          </ul>
          <GroupPager
            next={cultivarsNext}
            first={cultivarsFirst}
            label={t("search.more.cultivars")}
            t={t}
          />
        </section>
      ) : null}

      {growers.length > 0 || results.growers.current ? (
        <section aria-labelledby="group-growers" className="flex flex-col gap-3">
          <h3 id="group-growers" className="text-lg font-medium text-text">
            {t("search.groups.growers")}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {growers.map((result) => (
              <GrowerCard key={result.profileId} result={result} t={t} locale={locale} />
            ))}
          </ul>
          <GroupPager
            next={growersNext}
            first={growersFirst}
            label={t("search.more.growers")}
            t={t}
          />
        </section>
      ) : null}
    </div>
  );
}
