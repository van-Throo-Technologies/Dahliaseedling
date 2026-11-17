import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { HeldSeedlingChoice } from "@/components/capture/capture-flow";
import { displayLabels } from "@/modules/seedlings/repository";
import type { LabelWords } from "@/modules/seedlings/labels";

/*
 * The seedlings a grower can add a photo to: the ones they currently hold, most recent capture first. The list comes from the
 * database through the caller's own session, so it can never include a seedling the grower does not hold. Capture and the Feed
 * both use it, so the two always offer the same choices.
 */
export async function heldSeedlingChoices(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  words: LabelWords,
): Promise<HeldSeedlingChoice[]> {
  const { data } = await supabase.rpc("held_seedling_candidates", { p_limit: 200 });
  const candidates = data ?? [];
  const ids = candidates.map((item) => item.seedling_id);
  const labels = await displayLabels(supabase, ids, words);
  // Visibility is read through the same session, so the grower sees the visibility of their own seedlings only.
  const { data: rows } = ids.length
    ? await supabase.from("seedlings").select("id, visibility").in("id", ids)
    : { data: [] };
  const publicIds = new Set(
    (rows ?? []).filter((row) => row.visibility === "public").map((row) => row.id),
  );
  return candidates.map((item) => {
    const label = labels.get(item.seedling_id) ?? words.seedling;
    return {
      id: item.seedling_id,
      label: item.working_name ? `${label} · ${item.working_name}` : label,
      visibility: publicIds.has(item.seedling_id) ? "public" : "private",
    };
  });
}
