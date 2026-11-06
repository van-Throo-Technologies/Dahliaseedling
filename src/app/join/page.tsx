import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationRequestForm } from "@/components/invitations/request-form";
import { getTranslation } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("invitations.join.title"), robots: { index: false, follow: false } };
}

/*
 * The public entry point for invitation requests. It exists only while INVITATION_REQUESTS_ENABLED is "true". Any other value, or none,
 * makes it not found, so the feature can be switched off without a code change. The variable is read at request time and is not a
 * secret.
 */
export default async function JoinPage() {
  if (process.env.INVITATION_REQUESTS_ENABLED !== "true") notFound();

  const { t } = await getTranslation();
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("invitations.join.title")}
        </h1>
        <p className="text-base text-text-muted">{t("invitations.join.intro")}</p>
        <p className="text-base text-text-muted">{t("invitations.join.privacyNote")}</p>
      </div>
      <InvitationRequestForm />
    </section>
  );
}
