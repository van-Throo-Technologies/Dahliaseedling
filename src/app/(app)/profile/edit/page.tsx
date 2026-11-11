import type { Metadata } from "next";
import { ProfileEditForm } from "@/components/identity/profile-edit-form";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.edit.title") };
}

export default async function EditProfilePage() {
  const { profile } = await requireParticipant("/profile/edit");
  const { t } = await getTranslation();

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <h1 id="page-title" className="font-display text-3xl text-text-brand">
        {t("identity.edit.title")}
      </h1>
      <ProfileEditForm
        defaults={{
          displayName: profile.displayName,
          countryCode: profile.countryCode,
          regionCity: profile.regionCity ?? "",
          bio: profile.bio ?? "",
          accountTypeLabel: profile.accountTypeLabel ?? "",
        }}
      />
    </section>
  );
}
