import type { Metadata } from "next";
import { getTranslation } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("launch.legal.privacy.title"), robots: { index: false, follow: false } };
}

/** Review-pending placeholder. It is labelled as not approved and makes no legal claim. */
export default async function LegalPage() {
  const { t } = await getTranslation();
  return (
    <section aria-labelledby="legal-title" className="flex flex-col gap-6">
      <h1 id="legal-title" className="font-display text-3xl text-text-brand">
        {t("launch.legal.privacy.title")}
      </h1>
      <p
        role="note"
        className="rounded-surface border border-border bg-surface p-4 text-base font-medium text-text"
      >
        {t("launch.legal.banner")}
      </p>
      <p className="text-base text-text">{t("launch.legal.privacy.body")}</p>
      <p className="text-sm text-text-muted">{t("launch.legal.contact")}</p>
    </section>
  );
}
