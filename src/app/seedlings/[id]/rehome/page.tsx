import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { startRehomeAction } from "@/modules/rehome/actions";
import { getSeedling } from "@/modules/seedlings/repository";
import { isUuid } from "@/modules/seedlings/validation";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("rehome.start.title") };
}

/*
 * The holder's decision, as one small step. The seedling becomes public only if the holder ticks the public step and
 * the seedling is private. Price is information only: DahliaSeedling processes no payment.
 */
export default async function StartRehomePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { userId } = await requireParticipant(`/seedlings/${id}/rehome`);
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const seedling = await getSeedling(supabase, id);
  if (!seedling || seedling.currentHolderId !== userId) notFound();
  const isPrivate = seedling.visibility === "private";
  const field =
    "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-text";

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("rehome.start.title")}
        </h1>
        <p className="text-base text-text-muted">{t("rehome.start.intro")}</p>
      </div>

      <form action={startRehomeAction} className="flex flex-col gap-6">
        <input type="hidden" name="seedlingId" value={id} />

        <fieldset className="flex flex-col gap-3">
          <legend className="text-base font-medium text-text">
            {t("rehome.start.termLegend")}
          </legend>
          <p className="text-sm text-text-muted">{t("rehome.start.termHint")}</p>
          {(["donate", "sell", "trade"] as const).map((term) => (
            <label
              key={term}
              className="inline-flex min-h-11 items-center gap-3 text-base text-text"
            >
              <input
                type="radio"
                name="term"
                value={term}
                required
                className="h-6 w-6 accent-[var(--color-text-brand)]"
              />
              <span>{t(`rehome.terms.${term}` as "rehome.terms.donate")}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="priceText" className="text-base font-medium text-text">
            {t("rehome.start.priceLabel")}
          </label>
          <p className="text-sm text-text-muted">{t("rehome.start.priceHint")}</p>
          <input id="priceText" name="priceText" type="text" maxLength={80} className={field} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="handover" className="text-base font-medium text-text">
            {t("rehome.start.handoverLegend")}
          </label>
          <select id="handover" name="handover" className={field} defaultValue="">
            <option value="">—</option>
            <option value="pickup">{t("rehome.handover.pickup")}</option>
            <option value="shipping">{t("rehome.handover.shipping")}</option>
            <option value="both">{t("rehome.handover.both")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="note" className="text-base font-medium text-text">
            {t("rehome.start.noteLabel")}
          </label>
          <p className="text-sm text-text-muted">{t("rehome.start.noteHint")}</p>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={280}
            className="w-full rounded-control border border-border bg-surface p-3 text-base text-text"
          />
        </div>

        {isPrivate ? (
          <div className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4">
            <label className="inline-flex min-h-11 items-start gap-3 text-base text-text">
              <input
                type="checkbox"
                name="makePublic"
                required
                className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-text-brand)]"
              />
              <span>{t("rehome.start.makePublicLabel")}</span>
            </label>
            <p className="text-sm text-text-muted">{t("rehome.start.makePublicWhy")}</p>
          </div>
        ) : null}

        <label className="inline-flex min-h-11 items-start gap-3 text-base text-text">
          <input
            type="checkbox"
            name="understand"
            required
            className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-text-brand)]"
          />
          <span>{t("rehome.start.understand")}</span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-base font-medium text-on-primary"
          >
            {t("rehome.start.submit")}
          </button>
          <Link
            href={`/seedlings/${id}`}
            className="inline-flex min-h-11 items-center text-base text-text-brand"
          >
            {t("rehome.start.cancel")}
          </Link>
        </div>
      </form>
    </section>
  );
}
