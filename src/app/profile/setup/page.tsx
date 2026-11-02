import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileSetupForm } from "@/components/identity/profile-setup-form";
import { getTranslation } from "@/i18n/server";
import { safeNextPath } from "@/lib/http/safe-next";
import { getCurrentUser, getOwnProfile } from "@/modules/identity/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.setup.title") };
}

export default async function ProfileSetupPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");
  const { t } = await getTranslation();

  if (!(await getCurrentUser())) {
    const returnHere = `/profile/setup?next=${encodeURIComponent(destination)}`;
    redirect(`/sign-in?next=${encodeURIComponent(returnHere)}`);
  }
  if (await getOwnProfile()) redirect(destination);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("identity.setup.title")}
        </h1>
        <p className="text-base text-text-muted">{t("identity.setup.intro")}</p>
      </div>
      <ProfileSetupForm next={destination} />
    </section>
  );
}
