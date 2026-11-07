import type { Metadata } from "next";
import { CaptureFlow } from "@/components/capture/capture-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";
import { heldSeedlingChoices } from "@/modules/capture/choices";
import { isUuid } from "@/modules/capture/validation";
import { labelWords } from "@/modules/seedlings/labels";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("capture.capture.title") };
}

/*
 * The Seedlings offered for a Capture are the ones the signed-in grower currently holds, in the order the database returns them:
 * most recent capture first, then creation time, then identifier. Nothing else is offered. If the list cannot be read, the page
 * still offers New Seedling, so Capture never depends on the list.
 *
 * A seedling address (?seedling=…) starts the Capture on that seedling, so the grower does not choose it again. Only a seedling the
 * grower holds can be chosen this way.
 */
export default async function CapturePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ seedling?: string | string[] }>;
}) {
  await requireParticipant("/capture");
  const { t } = await getTranslation();
  const words = labelWords(t);
  const supabase = await createSupabaseServerClient();
  const { seedling } = await searchParams;
  const requested = Array.isArray(seedling) ? seedling[0] : seedling;

  return (
    <CaptureFlow
      seedlings={await heldSeedlingChoices(supabase, words)}
      initialSeedlingId={requested && isUuid(requested) ? requested : null}
    />
  );
}
