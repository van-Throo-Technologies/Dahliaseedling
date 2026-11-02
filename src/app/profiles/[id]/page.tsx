import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GrowerFollowForm } from "@/components/publications/social-buttons";
import { UpdateCard } from "@/components/publications/update-card";
import { PublicPhoto } from "@/components/publications/public-photo";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { avatarHref, countryName, formatMemberSince } from "@/modules/identity/presentation";
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
  { key: "seedlings", label: "Seedlings" },
  { key: "originated", label: "Originated" },
  { key: "updates", label: "Updates" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return { title: "Profile not found" };
  const profile = await getPublicProfile(id);
  return { title: profile ? profile.displayName : "Profile not found" };
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
  readonly searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const query = await searchParams;

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
              {countryName(profile.countryCode)}
              {profile.regionCity ? `, ${profile.regionCity}` : ""}
            </p>
            <p className="text-sm text-text-muted">{formatMemberSince(profile.createdAt)}</p>
          </div>
        </div>
        {profile.bio ? (
          <p className="whitespace-pre-line text-base text-text">{profile.bio}</p>
        ) : null}
        {!isSelf ? (
          <GrowerFollowForm profileId={profile.id} following={following} returnTo={returnTo} />
        ) : null}
      </header>

      <nav aria-label="Profile sections">
        <ul className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <li key={item.key}>
              <Link
                href={`/profiles/${profile.id}?tab=${item.key}`}
                aria-current={tab === item.key ? "page" : undefined}
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "updates" ? (
        updates.length === 0 ? (
          <p className="text-base text-text-muted">No public Updates yet.</p>
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
            ? "No public seedlings are held here yet."
            : "No public seedlings are recorded as originated here yet."}
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
                    No photo yet
                  </span>
                )}
                <span className="text-base font-medium text-text-brand">
                  {seedling.workingName ?? "Unnamed seedling"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
