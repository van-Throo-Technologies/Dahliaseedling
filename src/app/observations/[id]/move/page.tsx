import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MoveForm } from "@/components/capture/move-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { getObservation } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { displayLabels, listHeldSeedlings } from "@/modules/seedlings/repository";

export const metadata: Metadata = { title: "Change seedling" };

export default async function MoveObservationPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { userId } = await requireParticipant(`/observations/${id}/move`);

  const supabase = await createSupabaseServerClient();
  const observation = await getObservation(supabase, id);
  if (!observation || observation.authorId !== userId) notFound();

  const held = await listHeldSeedlings(supabase, userId);
  const labels = await displayLabels(
    supabase,
    held.map((item) => item.id),
  );

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          Change seedling
        </h1>
        <p className="text-base text-text-muted">
          Choose where this observation belongs. Its photos stay as they are.
        </p>
      </div>
      <MoveForm
        observationId={id}
        currentSeedlingId={observation.seedlingId}
        seedlings={held.map((item) => ({
          id: item.id,
          label: item.workingName
            ? `${labels.get(item.id) ?? "Seedling"} · ${item.workingName}`
            : (labels.get(item.id) ?? "Seedling"),
        }))}
      />
    </section>
  );
}
