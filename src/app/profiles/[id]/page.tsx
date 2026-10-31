import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { avatarHref, countryName, formatMemberSince } from "@/modules/identity/presentation";
import { getPublicProfile } from "@/modules/identity/session";

// Profile ids are UUIDs. Anything else is not a profile, so it never reaches the database.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Public profile. Visitors can read it without an account. Suspended profiles are not found. */
export default async function PublicProfilePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const avatarUrl = profile.avatarPath ? avatarHref(profile.id) : null;

  return (
    <article aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
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
      </header>

      {profile.bio ? (
        <p className="whitespace-pre-line text-base text-text">{profile.bio}</p>
      ) : null}
    </article>
  );
}
