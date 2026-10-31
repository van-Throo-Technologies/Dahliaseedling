import { ProfileEditForm } from "@/components/identity/profile-edit-form";
import { requireParticipant } from "@/modules/identity/gate";

export const metadata = { title: "Edit your profile" };

export default async function EditProfilePage() {
  const { profile } = await requireParticipant("/profile/edit");

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <h1 id="page-title" className="font-display text-3xl text-text-brand">
        Edit your profile
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
