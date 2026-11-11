import type { Metadata } from "next";
import { SeriesForm } from "@/components/seedlings/series-form";
import { getTranslation } from "@/i18n/server";
import { patternExample } from "@/modules/seedlings/presentation";
import { listSeries } from "@/modules/seedlings/repository";
import { requireParticipant } from "@/modules/identity/gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("seedlings.series.metaTitle") };
}

export default async function SeriesPage() {
  await requireParticipant("/series");
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const series = await listSeries(supabase);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="page-title" className="flex flex-col gap-3">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("seedlings.series.title")}
        </h1>
        <p className="text-base text-text-muted">{t("seedlings.series.intro")}</p>
      </section>

      <section aria-labelledby="existing-title" className="flex flex-col gap-3">
        <h2 id="existing-title" className="text-lg font-medium text-text">
          {t("seedlings.series.yourSeries")}
        </h2>
        {series.length === 0 ? (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            {t("seedlings.series.none")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {series.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 rounded-surface border border-border bg-surface p-4"
              >
                <span className="text-lg font-medium text-text-brand">{item.name}</span>
                <span className="text-sm text-text-muted">
                  {t("seedlings.series.identifiersLook", { example: patternExample(item.pattern) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="create-title" className="flex flex-col gap-4">
        <h2 id="create-title" className="text-lg font-medium text-text">
          {t("seedlings.series.add")}
        </h2>
        <SeriesForm />
      </section>
    </div>
  );
}
