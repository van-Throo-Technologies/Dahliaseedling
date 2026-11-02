import type { Metadata } from "next";
import { CaptureFlow } from "@/components/capture/capture-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";
import { labelWords } from "@/modules/seedlings/labels";
import { displayLabels, listHeldSeedlings } from "@/modules/seedlings/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("capture.capture.title") };
}

export default async function CapturePage() {
  const { userId } = await requireParticipant("/capture");
  const { t } = await getTranslation();
  const words = labelWords(t);
  const supabase = await createSupabaseServerClient();
  const held = await listHeldSeedlings(supabase, userId);
  const labels = await displayLabels(
    supabase,
    held.map((item) => item.id),
    words,
  );

  return (
    <CaptureFlow
      seedlings={held.map((item) => {
        const label = labels.get(item.id) ?? words.seedling;
        return {
          id: item.id,
          label: item.workingName ? `${label} · ${item.workingName}` : label,
        };
      })}
    />
  );
}
