import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/design-system/components/form-message";
import { SearchForm } from "@/components/search/search-form";
import { SearchResultsView } from "@/components/search/search-results";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { searchPublic } from "@/modules/search/repository";
import { validateSearch } from "@/modules/search/validation";

/** A repeated query parameter counts as its first value, so a query can never be read twice. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("publication.feed.explore") };
}

/*
 * Explore holds public search and its filters, which used to sit above the Feed. Visitors can search without an account. With no
 * query and no filter, Explore shows only the search form. A query or filter shows grouped results, and the address carries that
 * state, so back, forward and refresh behave.
 */
export default async function ExplorePage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    q?: string | string[];
    country?: string | string[];
    seedlings?: string | string[];
    cultivars?: string | string[];
    growers?: string | string[];
    available?: string | string[];
    seeds?: string | string[];
    seedOffers?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const { t } = await getTranslation();
  const search = validateSearch({
    q: query.q,
    country: query.country,
    available: query.available,
    seeds: query.seeds,
  });

  const heading = (
    <header className="flex flex-col gap-3">
      <h1 className="font-display text-3xl leading-tight text-text-brand">
        {t("publication.feed.explore")}
      </h1>
    </header>
  );

  if (!search.ok) {
    const first = Object.values(search.fieldErrors)[0];
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <SearchForm query={null} country={null} />
        {first ? <FormMessage tone="error">{t(first.key, first.values)}</FormMessage> : null}
        <Link href="/explore" className="text-base text-text-brand">
          {t("publication.feed.explore")}
        </Link>
      </div>
    );
  }

  const searchActive =
    search.value.query !== null ||
    search.value.country !== null ||
    search.value.available ||
    search.value.seeds;

  if (!searchActive) {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <SearchForm key="explore" query={null} country={null} />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const results = await searchPublic(supabase, search.value, {
    seedlings: firstValue(query.seedlings),
    cultivars: firstValue(query.cultivars),
    growers: firstValue(query.growers),
    seedOffers: firstValue(query.seedOffers),
  });

  // A typed identifier that belonged to a merged Seedling leads to the Seedling it was merged into, only when nothing else matched.
  const retiredCanonicalId =
    search.value.query !== null && results.seedlings.items.length === 0
      ? await supabase
          .rpc("resolve_retired_identifier", { p_query: search.value.query })
          .then(({ data }) => (typeof data === "string" ? data : null))
      : null;

  return (
    <div className="flex flex-col gap-6">
      {heading}
      <SearchForm
        key={`${search.value.query ?? ""}|${search.value.country ?? ""}|${search.value.available}`}
        query={search.value.query}
        country={search.value.country}
        available={search.value.available}
        seeds={search.value.seeds}
      />
      <SearchResultsView
        results={results}
        query={search.value.query}
        country={search.value.country}
        available={search.value.available}
        seeds={search.value.seeds}
        retiredCanonicalId={retiredCanonicalId}
      />
    </div>
  );
}
