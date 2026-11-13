import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { CaptureFlow } from "@/components/capture/capture-flow";
import { UpdateCard } from "@/components/publications/update-card";
import { PublicPhoto } from "@/components/publications/public-photo";
import { FormMessage } from "@/design-system/components/form-message";
import { ButtonLink } from "@/design-system/components/button-link";
import { PhotoIcon } from "@/design-system/icons";
import { isUuid } from "@/modules/capture/validation";
import { heldSeedlingChoices } from "@/modules/capture/choices";
import { labelWords } from "@/modules/seedlings/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { avatarHref } from "@/modules/identity/presentation";
import { getCurrentUser, getOwnProfile } from "@/modules/identity/session";
import { FEED_PAGE_SIZE } from "@/modules/publications/limits";
import { listFeedPage } from "@/modules/publications/repository";
import { encodeCursor, validateFeedCursor } from "@/modules/publications/validation";

/** A repeated query parameter counts as its first value, so a cursor can never be read twice. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Search moved to Explore. These parameters, from addresses that existed before, are passed on to it. */
const EXPLORE_PARAMS = [
  "q",
  "country",
  "available",
  "seeds",
  "seedlings",
  "cultivars",
  "growers",
  "seedOffers",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("publication.feed.title") };
}

/*
 * Home is the Feed, with the grower's creation row above it. The row opens the composer for a signed-in grower, and a visitor is
 * asked to sign in. Search and its filters live on Explore. Visitors can read the Feed without an account.
 */
export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    view?: string;
    compose?: string | string[];
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
  const exploreQuery = new URLSearchParams();
  for (const key of EXPLORE_PARAMS) {
    for (const value of [query[key]].flat()) {
      if (value !== undefined) exploreQuery.append(key, value);
    }
  }
  if (Array.from(exploreQuery).length > 0) redirect(`/explore?${exploreQuery.toString()}`);

  const { t } = await getTranslation();
  const viewer = await getCurrentUser();
  const cursor = validateFeedCursor(query.cursor);
  const followingView = viewer !== null && query.view === "following";

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

  const ownProfile = viewer ? await getOwnProfile() : null;
  const emptyState = followingView
    ? {
        title: t("publication.feed.emptyFollowingTitle"),
        text: t("publication.feed.emptyFollowingText"),
        action: null,
      }
    : viewer && ownProfile
      ? {
          title: t("publication.feed.emptyGrowerTitle"),
          text: t("publication.feed.emptyGrowerText"),
          action: { href: "/?compose=1", label: t("publication.feed.createPrompt") },
        }
      : viewer
        ? {
            title: t("publication.feed.emptyGrowerTitle"),
            text: t("publication.feed.emptySetupText"),
            action: {
              href: "/profile/setup?next=%2F",
              label: t("publication.feed.emptySetupAction"),
            },
          }
        : {
            title: t("publication.feed.emptyTitle"),
            text: t("publication.feed.emptyVisitorText"),
            action: {
              href: "/sign-in?next=%2F",
              label: t("publication.feed.emptyVisitorAction"),
            },
          };

  const supabase = await createSupabaseServerClient();
  // The composer opens when the creation row asks for it. A seedling page opens it with that seedling chosen; only a seedling the
  // grower holds is accepted.
  const composeRequested = firstValue(query.compose);
  const composing = composeRequested !== undefined;
  const composeFor = composeRequested && isUuid(composeRequested) ? composeRequested : null;
  const captureChoices =
    ownProfile && !ownProfile.isSuspended
      ? await heldSeedlingChoices(supabase, labelWords(t))
      : null;
  const page = await listFeedPage(supabase, {
    limit: FEED_PAGE_SIZE,
    before: cursor.value,
    followingOnly: followingView,
  });

  const recentSeedlings = [
    ...new Map(page.items.map((update) => [update.seedlingId, update])).values(),
  ].slice(0, 4);

  const base = followingView ? "/?view=following" : "/";
  const separator = followingView ? "&" : "?";
  const olderHref = page.next
    ? `${base}${separator}cursor=${encodeCursor(page.next.publishedAt, page.next.id)}`
    : null;

  return (
    <div className="min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,40rem)_minmax(0,20rem)] min-[1400px]:justify-center min-[1400px]:gap-10">
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="sr-only">{t("publication.feed.title")}</h1>

        {ownProfile && !ownProfile.isSuspended ? (
          <section
            aria-label={t("publication.feed.createLabel")}
            className="flex items-center gap-3 rounded-surface border border-border bg-surface p-3"
          >
            <ProfileAvatar
              name={ownProfile.displayName}
              url={ownProfile.avatarPath ? avatarHref(ownProfile.id) : null}
            />
            <Link
              href="/?compose=1"
              className="flex min-h-11 min-w-0 flex-1 items-center rounded-full border border-border px-4 text-base text-text-muted no-underline"
            >
              {t("publication.feed.createPrompt")}
            </Link>
            <Link
              href="/?compose=1#capture-photo"
              aria-label={t("publication.feed.addPhotos")}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-text-brand no-underline"
            >
              <PhotoIcon className="h-6 w-6" />
            </Link>
          </section>
        ) : viewer ? (
          <section
            aria-label={t("publication.feed.createLabel")}
            className="flex items-center gap-3 rounded-surface border border-border bg-surface p-3"
          >
            <Link
              href="/profile/setup?next=%2F%3Fcompose%3D1"
              className="flex min-h-11 min-w-0 flex-1 items-center rounded-full border border-border px-4 text-base text-text-muted no-underline"
            >
              {t("publication.feed.createPrompt")}
            </Link>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-border bg-surface px-4 py-3">
            <p className="text-sm text-text-muted">{t("publication.feed.signInInvite")}</p>
            <ButtonLink href="/sign-in?next=%2F%3Fcompose%3D1">
              {t("publication.feed.signInAction")}
            </ButtonLink>
          </section>
        )}

        {composing && captureChoices ? (
          <section className="rounded-surface border border-border bg-surface p-4">
            <CaptureFlow
              seedlings={captureChoices}
              initialSeedlingId={composeFor}
              embedded
              composer
            />
          </section>
        ) : null}

        <nav aria-label={t("publication.feed.viewLabel")}>
          <ul className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href="/"
                aria-current={followingView ? undefined : "page"}
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
              >
                {t("publication.feed.everyone")}
              </Link>
            </li>
            {viewer ? (
              <li>
                <Link
                  href="/?view=following"
                  aria-current={followingView ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
                >
                  {t("publication.feed.following")}
                </Link>
              </li>
            ) : null}
            <li className="ml-auto">
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center px-2 text-base text-text-brand"
              >
                {t("publication.feed.explore")}
              </Link>
            </li>
          </ul>
        </nav>

        {page.items.length === 0 ? (
          <section
            aria-labelledby="empty-title"
            className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4"
          >
            <h2 id="empty-title" className="text-lg font-medium text-text">
              {emptyState.title}
            </h2>
            <p className="text-base text-text-muted">{emptyState.text}</p>
            {emptyState.action ? (
              <ButtonLink href={emptyState.action.href}>{emptyState.action.label}</ButtonLink>
            ) : null}
          </section>
        ) : (
          <ul className="flex flex-col gap-6">
            {page.items.map((update) => (
              <li key={update.updateId}>
                <UpdateCard update={update} inlineComments={{ signedIn: viewer !== null }} />
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

      {/* Discovery, on wide screens only. It links to existing pages; it carries no data of its own. */}
      <aside
        aria-label={t("publication.feed.railLabel")}
        className="hidden min-[1400px]:sticky min-[1400px]:top-6 min-[1400px]:flex min-[1400px]:flex-col min-[1400px]:gap-4 min-[1400px]:self-start"
      >
        <section className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4">
          <h2 className="font-display text-lg text-text-brand">
            {t("publication.feed.railTitle")}
          </h2>
          <p className="text-sm text-text-muted">{t("publication.feed.railText")}</p>
          <ButtonLink href="/explore" variant="secondary">
            {t("publication.feed.railExplore")}
          </ButtonLink>
        </section>
        {recentSeedlings.length > 0 ? (
          <section
            aria-labelledby="recent-seedlings-title"
            className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4"
          >
            <h2 id="recent-seedlings-title" className="font-display text-lg text-text-brand">
              {t("publication.feed.railRecent")}
            </h2>
            <ul className="flex flex-col gap-2">
              {recentSeedlings.map((update) => (
                <li key={update.seedlingId}>
                  <Link
                    href={`/seedlings/${update.seedlingId}`}
                    className="flex min-h-11 items-center gap-3 rounded-control text-text no-underline"
                  >
                    {update.images[0] ? (
                      <span className="w-12 shrink-0">
                        <PublicPhoto image={update.images[0]} alt="" square />
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate text-sm font-medium text-text-brand">
                      {update.seedlingName ?? t("publication.update.unnamedSeedling")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
