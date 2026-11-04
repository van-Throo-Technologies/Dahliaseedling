import type { Metadata } from "next";
import Link from "next/link";
import { InstallGuidance } from "@/components/pwa/install-guidance";
import { ButtonLink } from "@/design-system/components/button-link";
import { FormMessage } from "@/design-system/components/form-message";
import { requireAccount } from "@/modules/identity/gate";
import { signOutAction } from "@/modules/identity/actions";
import { avatarHref, countryName, formatMemberSinceMonth } from "@/modules/identity/presentation";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { labelWords } from "@/modules/seedlings/labels";
import { displayLabels, listHeldSeedlings } from "@/modules/seedlings/repository";
import { displayedName } from "@/modules/identity/former-grower";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.profile.title") };
}

export default async function ProfilePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { notice } = await searchParams;
  const { profile, userId } = await requireAccount("/profile");
  const { t, locale } = await getTranslation();
  const avatarUrl = profile.avatarPath ? avatarHref(profile.id) : null;
  const suspendedNotice =
    notice === "suspended" || (Array.isArray(notice) && notice.includes("suspended"));

  return (
    <div className="flex flex-col gap-8">
      {suspendedNotice || profile.isSuspended ? (
        <FormMessage tone="error">{t("identity.profile.suspended")}</FormMessage>
      ) : null}

      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <ProfileAvatar
            name={displayedName(profile.displayName, t("privacy.formerGrower"))}
            url={avatarUrl}
            size="lg"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 id="page-title" className="font-display text-2xl text-text-brand">
              {displayedName(profile.displayName, t("privacy.formerGrower"))}
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

        <div className="flex flex-col gap-3 sm:flex-row">
          {profile.isSuspended ? null : (
            <ButtonLink href="/profile/edit">{t("identity.profile.editProfile")}</ButtonLink>
          )}
          <ButtonLink href={`/profiles/${userId}`} variant="secondary">
            {t("identity.profile.viewPublic")}
          </ButtonLink>
          <ButtonLink href="/privacy" variant="secondary">
            {t("privacy.link")}
          </ButtonLink>
          <ButtonLink href="/feedback" variant="secondary">
            {t("feedback.title")}
          </ButtonLink>
        </div>
        <InstallGuidance />
      </section>

      <SeedlingsSection userId={userId} suspended={profile.isSuspended} />

      <form action={signOutAction}>
        <button
          type="submit"
          className="min-h-11 rounded-control px-1 text-base font-medium text-text-brand underline underline-offset-4"
        >
          {t("identity.profile.signOut")}
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
  const { t } = await getTranslation();
  const words = labelWords(t);
  const supabase = await createSupabaseServerClient();
  const seedlings = await listHeldSeedlings(supabase, userId);
  const labels = await displayLabels(
    supabase,
    seedlings.map((item) => item.id),
    words,
  );

  return (
    <section aria-labelledby="seedlings-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="seedlings-title" className="text-lg font-medium text-text">
          {t("identity.profile.yourSeedlings")}
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          {suspended ? null : (
            <ButtonLink href="/seedlings/new">{t("identity.profile.newSeedling")}</ButtonLink>
          )}
          <ButtonLink href="/series" variant="secondary">
            {t("identity.profile.series")}
          </ButtonLink>
        </div>
      </div>
      {seedlings.length === 0 ? (
        <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
          {t("identity.profile.noSeedlings")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {seedlings.map((item) => {
            const label = labels.get(item.id) ?? words.seedling;
            return (
              <li key={item.id}>
                <Link
                  href={`/seedlings/${item.id}`}
                  className="flex min-h-11 flex-col gap-1 rounded-surface border border-border bg-surface p-4 no-underline"
                >
                  <span className="text-lg font-medium text-text-brand">
                    {item.workingName ?? label}
                  </span>
                  <span className="text-sm text-text-muted">
                    {label} ·{" "}
                    {item.visibility === "public" ? t("glossary.public") : t("glossary.private")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
