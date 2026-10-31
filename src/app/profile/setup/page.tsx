import { redirect } from "next/navigation";
import { ProfileSetupForm } from "@/components/identity/profile-setup-form";
import { safeNextPath } from "@/lib/http/safe-next";
import { getCurrentUser, getOwnProfile } from "@/modules/identity/session";

export const metadata = { title: "Set up your profile" };

export default async function ProfileSetupPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");

  if (!(await getCurrentUser())) {
    const returnHere = `/profile/setup?next=${encodeURIComponent(destination)}`;
    redirect(`/sign-in?next=${encodeURIComponent(returnHere)}`);
  }
  if (await getOwnProfile()) redirect(destination);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          Set up your profile
        </h1>
        <p className="text-base text-text-muted">
          Two things to start. You can add a photo, region and bio later.
        </p>
      </div>
      <ProfileSetupForm next={destination} />
    </section>
  );
}
