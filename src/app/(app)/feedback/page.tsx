import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { getTranslation } from "@/i18n/server";
import { requireAccount } from "@/modules/identity/gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("feedback.title") };
}

/**
 * Feedback from a signed-in grower. The page context is passed only as a path, so a query string on the page the grower came from is
 * never sent. The database also reduces the path and removes identifiers.
 */
export default async function FeedbackPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ from?: string | string[] }>;
}) {
  await requireAccount("/feedback");
  const { t } = await getTranslation();
  const query = await searchParams;
  const rawFrom = Array.isArray(query.from) ? query.from[0] : query.from;
  const from = typeof rawFrom === "string" ? rawFrom.split(/[?#]/)[0]!.slice(0, 200) : "";

  return (
    <section aria-labelledby="feedback-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="feedback-title" className="font-display text-3xl text-text-brand">
          {t("feedback.title")}
        </h1>
        <p className="text-base text-text-muted">{t("feedback.intro")}</p>
      </div>
      <FeedbackForm from={from} />
      <p>
        <Link href="/profile" className="text-base text-text-brand underline underline-offset-4">
          {t("app.nav.profile")}
        </Link>
      </p>
    </section>
  );
}
