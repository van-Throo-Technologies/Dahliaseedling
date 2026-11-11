import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/identity/sign-up-form";
import { getTranslation } from "@/i18n/server";
import { safeNextPath } from "@/lib/http/safe-next";
import { getCurrentUser } from "@/modules/identity/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.signUp.title") };
}

export default async function SignUpPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");
  const { t } = await getTranslation();

  if (await getCurrentUser()) redirect(destination);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("identity.signUp.title")}
        </h1>
        <p className="text-base text-text-muted">{t("identity.signUp.intro")}</p>
      </div>
      <SignUpForm next={destination} />
    </section>
  );
}
