import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MoveForm } from "@/components/capture/move-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";
import { getObservation } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { labelWords } from "@/modules/seedlings/labels";
import { displayLabels, listHeldSeedlings } from "@/modules/seedlings/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("capture.move.title") };
}

export default async function MoveObservationPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { userId } = await requireParticipant(`/observations/${id}/move`);
  const { t } = await getTranslation();
  const words = labelWords(t);

  const supabase = await createSupabaseServerClient();
  const observation = await getObservation(supabase, id);
  if (!observation || observation.authorId !== userId) notFound();

  const held = await listHeldSeedlings(supabase, userId);
  const labels = await displayLabels(
    supabase,
    held.map((item) => item.id),
    words,
  );

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("capture.move.title")}
        </h1>
        <p className="text-base text-text-muted">{t("capture.move.intro")}</p>
      </div>
      <MoveForm
        observationId={id}
        currentSeedlingId={observation.seedlingId}
        seedlings={held.map((item) => {
          const label = labels.get(item.id) ?? words.seedling;
          return {
            id: item.id,
            label: item.workingName ? `${label} · ${item.workingName}` : label,
          };
        })}
      />
    </section>
  );
}
