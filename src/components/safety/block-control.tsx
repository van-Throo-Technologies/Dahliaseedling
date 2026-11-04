import { getTranslation } from "@/i18n/server";
import { blockGrowerAction, unblockGrowerAction } from "@/modules/messaging/actions";

/*
 * Block or unblock another grower. A block is shown plainly with what it does, so no one is surprised by it. It is a
 * form, so it works without script, and the notice comes back on the same page.
 */

interface BlockControlProps {
  readonly targetId: string;
  readonly returnTo: string;
  readonly blocked: boolean;
  readonly id: string;
}

export async function BlockControl({ targetId, returnTo, blocked, id }: BlockControlProps) {
  const { t } = await getTranslation();
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-3">
      <h2 id={`${id}-title`} className="sr-only">
        {t(blocked ? "safety.block.blocked" : "safety.block.block")}
      </h2>
      {blocked ? null : <p className="text-base text-text-muted">{t("safety.block.explain")}</p>}
      <form action={blocked ? unblockGrowerAction : blockGrowerAction}>
        <input type="hidden" name="target" value={targetId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface px-4 py-2 text-base font-medium text-text-brand transition-colors hover:border-text-brand"
        >
          {t(blocked ? "safety.block.unblock" : "safety.block.block")}
        </button>
      </form>
    </section>
  );
}
