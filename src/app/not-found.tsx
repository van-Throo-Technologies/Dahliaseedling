import type { Metadata } from "next";
import { ButtonLink } from "@/design-system/components/button-link";
import { getTranslation } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("errors.notFound") };
}

/** Shown for any address that does not exist. It names nothing about the address, so it reveals nothing. */
export default async function NotFound() {
  const { t } = await getTranslation();
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <h1 id="page-title" className="font-display text-3xl text-text-brand">
        {t("errors.notFound")}
      </h1>
      <ButtonLink href="/" variant="secondary">
        {t("app.nav.home")}
      </ButtonLink>
    </section>
  );
}
