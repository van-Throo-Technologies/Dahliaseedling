import { CaptureFlow } from "@/components/capture/capture-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { displayLabels, listHeldSeedlings } from "@/modules/seedlings/repository";

export const metadata = { title: "Capture" };

export default async function CapturePage() {
  const { userId } = await requireParticipant("/capture");
  const supabase = await createSupabaseServerClient();
  const held = await listHeldSeedlings(supabase, userId);
  const labels = await displayLabels(
    supabase,
    held.map((item) => item.id),
  );

  return (
    <CaptureFlow
      seedlings={held.map((item) => ({
        id: item.id,
        label: item.workingName
          ? `${labels.get(item.id) ?? "Seedling"} · ${item.workingName}`
          : (labels.get(item.id) ?? "Seedling"),
      }))}
    />
  );
}
