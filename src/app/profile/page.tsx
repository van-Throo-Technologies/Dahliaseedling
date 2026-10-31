import { ButtonLink } from "@/design-system/components/button-link";
import { FormMessage } from "@/design-system/components/form-message";
import { requireAccount } from "@/modules/identity/gate";
import { signOutAction } from "@/modules/identity/actions";
import { avatarHref, countryName, formatMemberSince } from "@/modules/identity/presentation";
import { ProfileAvatar } from "@/components/identity/profile-avatar";

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
