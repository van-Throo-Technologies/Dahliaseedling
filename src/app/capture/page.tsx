import type { Metadata } from "next";
import { CaptureFlow } from "@/components/capture/capture-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";
import { labelWords } from "@/modules/seedlings/labels";
import { displayLabels } from "@/modules/seedlings/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("capture.capture.title") };
}

/*
 * The Seedlings offered for a Capture are the ones the signed-in grower currently holds, in the order the database returns them:
 * most recent capture first, then creation time, then identifier. Nothing else is offered. If the list cannot be read, the page
 * still offers New Seedling, so Capture never depends on the list.
 */
export default async function CapturePage() {
  await requireParticipant("/capture");
  const { t } = await getTranslation();
  const words = labelWords(t);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("held_seedling_candidates", { p_limit: 200 });
  const candidates = data ?? [];
  const labels = await displayLabels(
    supabase,
    candidates.map((item) => item.seedling_id),
    words,
  );

  return (
    <CaptureFlow
      seedlings={candidates.map((item) => {
        const label = labels.get(item.seedling_id) ?? words.seedling;
        return {
          id: item.seedling_id,
          label: item.working_name ? `${label} · ${item.working_name}` : label,
        };
      })}
    />
  );
}
