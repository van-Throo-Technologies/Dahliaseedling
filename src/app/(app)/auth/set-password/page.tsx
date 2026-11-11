import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormMessage } from "@/design-system/components/form-message";
import { SetPasswordForm } from "@/components/identity/set-password-form";
import { getTranslation } from "@/i18n/server";
import { safeNextPath } from "@/lib/http/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invitationPasswordPending } from "@/modules/identity/password-setup";
import { getCurrentUser } from "@/modules/identity/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.setPassword.title") };
}

export default async function SetPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");
  const { t } = await getTranslation();

  // A signed-out visitor signs in first. The session alone does not open the form: see invitationPasswordPending.
  if (!(await getCurrentUser())) {
    const returnHere = `/auth/set-password?next=${encodeURIComponent(destination)}`;
    redirect(`/sign-in?next=${encodeURIComponent(returnHere)}`);
  }

  if (!(await invitationPasswordPending(await createSupabaseServerClient()))) {
    return (
      <section aria-labelledby="page-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 id="page-title" className="font-display text-3xl text-text-brand">
            {t("identity.setPassword.closedTitle")}
          </h1>
        </div>
        <FormMessage tone="error">{t("identity.setPassword.notInvited")}</FormMessage>
      </section>
    );
  }

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("identity.setPassword.title")}
        </h1>
        <p className="text-base text-text-muted">{t("identity.setPassword.intro")}</p>
      </div>
      <SetPasswordForm next={destination} />
    </section>
  );
}
