import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/design-system/components/form-message";
import { ForgotPasswordForm } from "@/components/identity/forgot-password-form";
import { getTranslation } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.recovery.forgotTitle") };
}

/*
 * Asks for a reset link. A reset link that failed lands here with a short code, which the page turns into text.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ link?: string | string[] }>;
}) {
  const { link } = await searchParams;
  const { t } = await getTranslation();
  const failure = Array.isArray(link) ? link[0] : link;
  const notice =
    failure === "expired"
      ? t("identity.recovery.expired")
      : failure === "invalid"
        ? t("identity.recovery.invalid")
        : null;

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("identity.recovery.forgotTitle")}
        </h1>
        <p className="text-base text-text-muted">{t("identity.recovery.forgotIntro")}</p>
      </div>
      {notice ? <FormMessage tone="error">{notice}</FormMessage> : null}
      <ForgotPasswordForm />
      <p className="text-base text-text-muted">
        <Link href="/sign-in" className="font-medium text-text-brand underline underline-offset-4">
          {t("identity.signIn.submit")}
        </Link>
      </p>
    </section>
  );
}
