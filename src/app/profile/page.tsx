import Link from "next/link";
import { ButtonLink } from "@/design-system/components/button-link";
import { FormMessage } from "@/design-system/components/form-message";
import { requireAccount } from "@/modules/identity/gate";
import { signOutAction } from "@/modules/identity/actions";
import { avatarHref, countryName, formatMemberSince } from "@/modules/identity/presentation";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayLabels, listHeldSeedlings } from "@/modules/seedlings/repository";
import { visibilityLabel } from "@/modules/seedlings/presentation";

export const metadata = { title: "Your profile" };

export default async function ProfilePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { notice } = await searchParams;
  const { profile, userId } = await requireAccount("/profile");
  const avatarUrl = profile.avatarPath ? avatarHref(profile.id) : null;
  const suspendedNotice =
    notice === "suspended" || (Array.isArray(notice) && notice.includes("suspended"));

  return (
    <div className="flex flex-col gap-8">
      {suspendedNotice || profile.isSuspended ? (
        <FormMessage tone="error">
          Your account is suspended. You can still see your profile, but you cannot edit it or take
          part until it is reinstated.
        </FormMessage>
      ) : null}

      <section aria-labelledby="page-title" className="flex flex-col gap-6">
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

        <div className="flex flex-col gap-3 sm:flex-row">
          {profile.isSuspended ? null : <ButtonLink href="/profile/edit">Edit profile</ButtonLink>}
          <ButtonLink href={`/profiles/${userId}`} variant="secondary">
            View public profile
          </ButtonLink>
        </div>
      </section>

      <SeedlingsSection userId={userId} suspended={profile.isSuspended} />

      <form action={signOutAction}>
        <button
          type="submit"
          className="min-h-11 rounded-control px-1 text-base font-medium text-text-brand underline underline-offset-4"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

/** The seedlings this grower currently holds. Each links to its page; private ones are visible here only. */
async function SeedlingsSection({
  userId,
  suspended,
}: {
  readonly userId: string;
  readonly suspended: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const seedlings = await listHeldSeedlings(supabase, userId);
  const labels = await displayLabels(
    supabase,
    seedlings.map((item) => item.id),
  );

  return (
    <section aria-labelledby="seedlings-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="seedlings-title" className="text-lg font-medium text-text">
          Your seedlings
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          {suspended ? null : <ButtonLink href="/seedlings/new">New seedling</ButtonLink>}
          <ButtonLink href="/series" variant="secondary">
            Series
          </ButtonLink>
        </div>
      </div>
      {seedlings.length === 0 ? (
        <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
          No seedlings yet. A new seedling stays private until you choose otherwise.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {seedlings.map((item) => (
            <li key={item.id}>
              <Link
                href={`/seedlings/${item.id}`}
                className="flex min-h-11 flex-col gap-1 rounded-surface border border-border bg-surface p-4 no-underline"
              >
                <span className="text-lg font-medium text-text-brand">
                  {item.workingName ?? labels.get(item.id)}
                </span>
                <span className="text-sm text-text-muted">
                  {labels.get(item.id)} · {visibilityLabel(item.visibility)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
