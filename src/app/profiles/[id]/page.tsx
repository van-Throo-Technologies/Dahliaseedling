import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessagingFeedback } from "@/components/messaging/feedback-message";
import { StartConversation } from "@/components/messaging/start-conversation";
import { BlockControl } from "@/components/safety/block-control";
import { ReportControl } from "@/components/safety/report-control";
import { GrowerFollowForm } from "@/components/publications/social-buttons";
import { UpdateCard } from "@/components/publications/update-card";
import { SeedOfferList } from "@/components/seeds/seed-offer-list";
import { liveOffersBySeller } from "@/modules/seeds/repository";
import { PublicPhoto } from "@/components/publications/public-photo";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { formatMemberSinceMonth, countryName, avatarHref } from "@/modules/identity/presentation";
import { getCurrentUser, getPublicProfile } from "@/modules/identity/session";
import {
  listHeldPublicSeedlings,
  listOriginatedPublicSeedlings,
  listUpdatesByAuthor,
  type SeedlingCard,
} from "@/modules/publications/repository";

// Profile ids are UUIDs. Anything else is not a profile, so it never reaches the database.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TABS = [
  { key: "seedlings", labelKey: "identity.publicProfile.tabSeedlings" },
  { key: "originated", labelKey: "identity.publicProfile.tabOriginated" },
  { key: "updates", labelKey: "identity.publicProfile.tabUpdates" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { t } = await getTranslation();
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return { title: t("identity.publicProfile.notFound") };
  const profile = await getPublicProfile(id);
  return { title: profile ? profile.displayName : t("identity.publicProfile.notFound") };
}

/**
 * Public profile, with three tabs. Each tab shows only what a visitor may read: public seedlings the grower
 * holds, public seedlings the grower originated (even when someone else holds them now), and the live public
 * Updates the grower wrote. Suspended profiles are not found.
 */
export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{
    tab?: string;
    seedNotice?: string;
    seedError?: string;
    messagingNotice?: string;
    messagingError?: string;
  }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const query = await searchParams;
  const { t, locale } = await getTranslation();

  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const tab: TabKey = TABS.some((item) => item.key === query.tab)
    ? (query.tab as TabKey)
    : "seedlings";
  const avatarUrl = profile.avatarPath ? avatarHref(profile.id) : null;
  const viewer = await getCurrentUser();
  const isSelf = viewer !== null && viewer.id === profile.id;
  const supabase = await createSupabaseServerClient();
  const returnTo = `/profiles/${profile.id}?tab=${tab}`;
  // The reader's own block list is the only one they can see, so this asks about the pair from their side alone.
  const blockedByMe =
    viewer !== null && !isSelf
      ? (
          await supabase
            .from("blocks")
            .select("blocked_id")
            .eq("blocked_id", profile.id)
            .maybeSingle()
        ).data !== null
      : false;
  const offers = await liveOffersBySeller(supabase, profile.id, viewer?.id ?? null);

  const following =
    viewer !== null && !isSelf
      ? (
          await supabase
            .from("grower_follows")
            .select("followed_profile_id")
            .eq("followed_profile_id", profile.id)
            .maybeSingle()
        ).data !== null
      : false;

  const seedlings: SeedlingCard[] =
    tab === "seedlings"
      ? await listHeldPublicSeedlings(supabase, profile.id)
      : tab === "originated"
        ? await listOriginatedPublicSeedlings(supabase, profile.id)
        : [];
  const updates =
    tab === "updates"
      ? await listUpdatesByAuthor(supabase, {
          id: profile.id,
          displayName: profile.displayName,
          hasAvatar: profile.avatarPath !== null,
        })
      : [];

  return (
    <article aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ProfileAvatar name={profile.displayName} url={avatarUrl} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 id="page-title" className="font-display text-2xl text-text-brand">
              {profile.displayName}
            </h1>
            <p className="text-base text-text-muted">
              {countryName(profile.countryCode, locale)}
              {profile.regionCity ? `, ${profile.regionCity}` : ""}
            </p>
            <p className="text-sm text-text-muted">
              {t("identity.profile.memberSince", {
                month: formatMemberSinceMonth(profile.createdAt, locale),
              })}
            </p>
          </div>
        </div>
        {profile.bio ? (
          <p className="whitespace-pre-line text-base text-text">{profile.bio}</p>
        ) : null}
        {!isSelf ? (
          <GrowerFollowForm profileId={profile.id} following={following} returnTo={returnTo} />
        ) : null}
        <MessagingFeedback error={query.messagingError} notice={query.messagingNotice} />
        {!isSelf ? (
          viewer ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-3">
                <StartConversation
                  kind="direct"
                  target={profile.id}
                  returnTo={returnTo}
                  label={t("messaging.start.direct")}
                  id="start-direct"
                />
              </div>
              <BlockControl
                targetId={profile.id}
                returnTo={returnTo}
                blocked={blockedByMe}
                id="block-grower"
              />
              <ReportControl
                targetType="profile"
                targetId={profile.id}
                returnTo={returnTo}
                id="report-profile"
              />
            </div>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
              className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
            >
              {t("messaging.start.signIn")}
            </Link>
          )
        ) : null}
      </header>

      <nav aria-label={t("identity.publicProfile.sections")}>
        <ul className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <li key={item.key}>
              <Link
                href={`/profiles/${profile.id}?tab=${item.key}`}
                aria-current={tab === item.key ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
              >
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {offers.length > 0 || query.seedNotice || query.seedError ? (
        <div className="mt-6">
          <SeedOfferList
            offers={offers}
            viewerId={viewer?.id ?? null}
            returnTo={`/profiles/${profile.id}`}
            signInHref={`/sign-in?next=${encodeURIComponent(`/profiles/${profile.id}`)}`}
            notice={query.seedNotice}
            failure={query.seedError}
          />
        </div>
      ) : null}

      {tab === "updates" ? (
        updates.length === 0 ? (
          <p className="text-base text-text-muted">{t("identity.publicProfile.noUpdates")}</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {updates.map((update) => (
              <li key={update.updateId}>
                <UpdateCard update={update} />
              </li>
            ))}
          </ul>
        )
      ) : seedlings.length === 0 ? (
        <p className="text-base text-text-muted">
          {tab === "seedlings"
            ? t("identity.publicProfile.noHeld")
            : t("identity.publicProfile.noOriginated")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {seedlings.map((seedling) => (
            <li key={seedling.id}>
              <Link
                href={`/seedlings/${seedling.id}`}
                className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-3 no-underline"
              >
                {seedling.cover ? (
                  <PublicPhoto image={seedling.cover} alt="" />
                ) : (
                  <span className="rounded-surface bg-background p-6 text-sm text-text-muted">
                    {t("identity.publicProfile.noPhoto")}
                  </span>
                )}
                <span className="text-base font-medium text-text-brand">
                  {seedling.workingName ?? t("identity.publicProfile.unnamedSeedling")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
