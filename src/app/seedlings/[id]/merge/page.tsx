import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MergeForm } from "@/components/seedlings/merge-form";
import { FormMessage } from "@/design-system/components/form-message";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/capture/validation";
import { requireParticipant } from "@/modules/identity/gate";
import { labelWords } from "@/modules/seedlings/labels";
import { displayLabels, getSeedling } from "@/modules/seedlings/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("assistive.merge.title") };
}

const ERROR: Record<string, MessageKey> = {
  notAllowed: "assistive.merge.errors.notAllowed",
  notFound: "assistive.merge.errors.notFound",
  notConfirmed: "assistive.merge.errors.notConfirmed",
  retired: "assistive.merge.errors.retired",
  differentOriginators: "assistive.merge.errors.differentOriginators",
  continuation: "assistive.merge.errors.continuation",
  offer: "assistive.merge.errors.offer",
  alerts: "assistive.merge.errors.alerts",
  generic: "assistive.merge.errors.generic",
};

/**
 * Merging is offered only to the current holder of this Seedling. It is shown only when there is another active Seedling of the
 * same holder. The database checks again at confirmation, so this page is convenience, not authority.
 */
export default async function MergeSeedlingPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ mergeError?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { userId } = await requireParticipant(`/seedlings/${id}/merge`);
  const { t } = await getTranslation();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const seedling = await getSeedling(supabase, id);
  if (!seedling || seedling.currentHolderId !== userId) notFound();

  const words = labelWords(t);
  const { data } = await supabase.rpc("held_seedling_candidates", { p_limit: 200 });
  const others = (data ?? []).filter((item) => item.seedling_id !== id);
  const labels = await displayLabels(
    supabase,
    [id, ...others.map((item) => item.seedling_id)],
    words,
  );
  const named = (seedlingId: string, workingName: string | null) => {
    const label = labels.get(seedlingId) ?? words.seedling;
    return workingName ? `${label} · ${workingName}` : label;
  };
  const error = query.mergeError ? ERROR[query.mergeError] : undefined;

  return (
    <section aria-labelledby="merge-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="merge-title" className="font-display text-3xl text-text-brand">
          {t("assistive.merge.title")}
        </h1>
        <p className="text-base text-text-muted">{t("assistive.merge.intro")}</p>
      </div>
      <p className="rounded-surface border border-destructive p-4 text-base text-text">
        {t("assistive.merge.warning")}
      </p>
      {error ? <FormMessage tone="error">{t(error)}</FormMessage> : null}
      {others.length === 0 ? (
        <p className="text-base text-text-muted">{t("assistive.merge.noOther")}</p>
      ) : (
        <MergeForm
          thisId={id}
          thisLabel={named(id, seedling.workingName)}
          others={others.map((item) => ({
            id: item.seedling_id,
            label: named(item.seedling_id, item.working_name),
          }))}
        />
      )}
    </section>
  );
}
