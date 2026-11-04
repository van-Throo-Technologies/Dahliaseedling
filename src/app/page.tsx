import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/design-system/components/form-message";
import { UpdateCard } from "@/components/publications/update-card";
import { SearchForm } from "@/components/search/search-form";
import { SearchResultsView } from "@/components/search/search-results";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { getCurrentUser } from "@/modules/identity/session";
import { FEED_PAGE_SIZE } from "@/modules/publications/limits";
import { listFeedPage } from "@/modules/publications/repository";
import { encodeCursor, validateFeedCursor } from "@/modules/publications/validation";
import { searchPublic } from "@/modules/search/repository";
import { validateSearch } from "@/modules/search/validation";

/** A repeated query parameter counts as its first value, so a cursor or query can never be read twice. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("publication.feed.title") };
}

/*
 * Home is the public Feed, with one Search box above it. Visitors can read and search without an account.
 * With no query and no country the Feed is shown exactly as before. A query or a country replaces the Feed with
 * grouped results, and the address carries that state, so back, forward and refresh behave.
 */
export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    view?: string;
    cursor?: string;
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
  const viewer = await getCurrentUser();
  const search = validateSearch({
    q: query.q,
    country: query.country,
    available: query.available,
    seeds: query.seeds,
  });
  const searchActive =
    search.ok &&
    (search.value.query !== null ||
      search.value.country !== null ||
      search.value.available ||
      search.value.seeds);
  const followingView = !searchActive && query.view === "following" && viewer !== null;
  const cursor = validateFeedCursor(query.cursor);

  const heading = (
    <header className="flex flex-col gap-3">
      <h1 className="font-display text-3xl leading-tight text-text-brand">
        {t("publication.feed.title")}
      </h1>
      <p className="text-base text-text-muted">{t("publication.feed.intro")}</p>
    </header>
  );

  if (!search.ok) {
    const first = Object.values(search.fieldErrors)[0];
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <SearchForm query={null} country={null} />
        {first ? <FormMessage tone="error">{t(first.key, first.values)}</FormMessage> : null}
        <Link href="/" className="text-base text-text-brand">
          {t("publication.feed.backToFeed")}
        </Link>
      </div>
    );
  }

  if (searchActive) {
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

  if (!cursor.ok) {
    return (
      <div className="flex flex-col gap-6">
        <FormMessage tone="error">{t(cursor.message.key, cursor.message.values)}</FormMessage>
        <Link href="/" className="text-base text-text-brand">
          {t("publication.feed.backToFeed")}
        </Link>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const page = await listFeedPage(supabase, {
    limit: FEED_PAGE_SIZE,
    before: cursor.value,
    followingOnly: followingView,
  });

  const base = followingView ? "/?view=following" : "/";
  const separator = followingView ? "&" : "?";
  const olderHref = page.next
    ? `${base}${separator}cursor=${encodeCursor(page.next.publishedAt, page.next.id)}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl leading-tight text-text-brand">
          {t("publication.feed.title")}
        </h1>
        <p className="text-base text-text-muted">{t("publication.feed.intro")}</p>
      </header>

      <SearchForm key="feed" query={null} country={null} />

      {viewer ? (
        <nav aria-label={t("publication.feed.viewLabel")}>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/"
                aria-current={followingView ? undefined : "page"}
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
              >
                {t("publication.feed.everyone")}
              </Link>
            </li>
            <li>
              <Link
                href="/?view=following"
                aria-current={followingView ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
              >
                {t("publication.feed.following")}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}

      {page.items.length === 0 ? (
        <section
          aria-labelledby="empty-title"
          className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-4"
        >
          <h2 id="empty-title" className="text-lg font-medium text-text">
            {followingView
              ? t("publication.feed.emptyFollowingTitle")
              : t("publication.feed.emptyTitle")}
          </h2>
          <p className="text-base text-text-muted">
            {followingView
              ? t("publication.feed.emptyFollowingText")
              : t("publication.feed.emptyText")}
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-6">
          {page.items.map((update) => (
            <li key={update.updateId}>
              <UpdateCard update={update} />
            </li>
          ))}
        </ul>
      )}

      {olderHref ? (
        <nav aria-label={t("publication.feed.olderLabel")}>
          <Link
            href={olderHref}
            className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
          >
            {t("publication.feed.showOlder")}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
