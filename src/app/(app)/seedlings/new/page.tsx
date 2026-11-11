import type { Metadata } from "next";
import { NewSeedlingForm } from "@/components/seedlings/new-seedling-form";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";
import { listSeries } from "@/modules/seedlings/repository";
import { patternUsesYear } from "@/modules/seedlings/presentation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("seedlings.create.title") };
}

export default async function NewSeedlingPage() {
  await requireParticipant("/seedlings/new");
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const series = (await listSeries(supabase)).filter((item) => item.active);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("seedlings.create.title")}
        </h1>
        <p className="text-base text-text-muted">{t("seedlings.create.intro")}</p>
      </div>
      <NewSeedlingForm
        series={series.map((item) => ({
          id: item.id,
          name: item.name,
          usesYear: patternUsesYear(item.pattern),
        }))}
      />
    </section>
  );
}
