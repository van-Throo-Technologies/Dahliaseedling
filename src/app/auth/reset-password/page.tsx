import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ResetPasswordForm } from "@/components/identity/reset-password-form";
import { getTranslation } from "@/i18n/server";
import { RESET_COOKIE } from "@/modules/identity/password-reset";
import { getCurrentUser } from "@/modules/identity/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.recovery.resetTitle") };
}

/*
 * Choosing a new password after a reset link. The page opens only for a session the link created in this browser, with the short-lived
 * reset mark the link left. Anything else is sent to request a new link.
 */
export default async function ResetPasswordPage() {
  const { t } = await getTranslation();
  const user = await getCurrentUser();
  const marked = (await cookies()).has(RESET_COOKIE);
  if (!user || !marked) redirect("/forgot-password?link=expired");

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("identity.recovery.resetTitle")}
        </h1>
        <p className="text-base text-text-muted">{t("identity.recovery.resetIntro")}</p>
      </div>
      <ResetPasswordForm />
    </section>
  );
}
