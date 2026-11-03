import type { Metadata } from "next";
import { FormMessage } from "@/design-system/components/form-message";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { requireParticipant } from "@/modules/identity/gate";
import { createSeedOfferAction } from "@/modules/seeds/actions";
import { isUuid } from "@/modules/seedlings/validation";

/*
 * Offer seeds or seedheads. The grower says where the material comes from and what they know about the plant. The form
 * asks only for what the rules need: a photograph for an unidentified dahlia or a named cultivar, a number for packets or
 * seedheads, and the terms. The database checks the rest, so a refused form creates nothing.
 */

const FIELD =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-text";
const LABEL = "text-sm font-medium text-text";
const OPTION = "inline-flex min-h-11 items-center gap-3 text-base text-text";
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-base font-medium text-on-primary";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("seeds.offerTitle") };
}

export default async function NewOfferPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ seedling?: string; seedError?: string }>;
}) {
  await requireParticipant("/offers/new");
  const query = await searchParams;
  const { t } = await getTranslation();
  const seedling = query.seedling && isUuid(query.seedling) ? query.seedling : null;
  const failure = query.seedError;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl leading-tight text-text-brand">
          {t("seeds.offerTitle")}
        </h1>
        <p className="text-base text-text-muted">{t("seeds.offerIntro")}</p>
      </header>
      {failure ? <FormMessage tone="error">{t(failure as MessageKey)}</FormMessage> : null}

      <form
        action={createSeedOfferAction}
        encType="multipart/form-data"
        className="flex flex-col gap-6"
      >
        {seedling ? <input type="hidden" name="seedlingId" value={seedling} /> : null}

        <fieldset className="flex flex-col gap-3">
          <legend className={LABEL}>{t("seeds.source.legend")}</legend>
          {seedling ? (
            <label className={OPTION}>
              <input type="radio" name="kind" value="seedling" defaultChecked className="h-6 w-6" />
              <span>{t("seeds.source.seedling")}</span>
            </label>
          ) : null}
          <label className={OPTION}>
            <input type="radio" name="kind" value="cultivar" className="h-6 w-6" />
            <span>{t("seeds.source.cultivar")}</span>
          </label>
          <label htmlFor="cultivarName" className={LABEL}>
            {t("seeds.cultivarName")}
          </label>
          <input id="cultivarName" name="cultivarName" maxLength={80} className={FIELD} />
          <label htmlFor="parentPhoto" className={LABEL}>
            {t("seeds.parentPhoto")}
          </label>
          <p className="text-sm text-text-muted">{t("seeds.parentPhotoHint")}</p>
          <input
            id="parentPhoto"
            name="parentPhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={FIELD}
          />

          <label className={OPTION}>
            <input type="radio" name="kind" value="unidentified" className="h-6 w-6" />
            <span>{t("seeds.source.unidentified")}</span>
          </label>
          <p className="text-sm text-text-muted">{t("seeds.source.unidentifiedHint")}</p>
          <label htmlFor="description" className={LABEL}>
            {t("seeds.description")}
          </label>
          <p className="text-sm text-text-muted">{t("seeds.descriptionHint")}</p>
          <textarea
            id="description"
            name="description"
            maxLength={280}
            rows={3}
            className={FIELD}
          />
          <label htmlFor="sourcePhoto" className={LABEL}>
            {t("seeds.sourcePhoto")}
          </label>
          <p className="text-sm text-text-muted">{t("seeds.sourcePhotoHint")}</p>
          <input
            id="sourcePhoto"
            name="sourcePhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={FIELD}
          />

          <label className={OPTION}>
            <input type="radio" name="kind" value="unknown_mixed" className="h-6 w-6" />
            <span>{t("seeds.source.unknownMixed")}</span>
          </label>
          <p className="text-sm text-text-muted">{t("seeds.source.unknownMixedHint")}</p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className={LABEL}>{t("seeds.material.legend")}</legend>
          <label className={OPTION}>
            <input
              type="radio"
              name="material"
              value="loose_seeds"
              defaultChecked
              className="h-6 w-6"
            />
            <span>{t("seeds.material.seeds")}</span>
          </label>
          <label htmlFor="packetSize" className={LABEL}>
            {t("seeds.packetSize")}
          </label>
          <input
            id="packetSize"
            name="packetSize"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            className={FIELD}
          />
          <label className={OPTION}>
            <input type="radio" name="material" value="seedheads" className="h-6 w-6" />
            <span>{t("seeds.material.seedheads")}</span>
          </label>
          <label htmlFor="seedheadCount" className={LABEL}>
            {t("seeds.seedheadCount")}
          </label>
          <input
            id="seedheadCount"
            name="seedheadCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            className={FIELD}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className={LABEL}>{t("seeds.mode.legend")}</legend>
          <label className={OPTION}>
            <input type="radio" name="mode" value="free" defaultChecked className="h-6 w-6" />
            <span>{t("seeds.mode.free")}</span>
          </label>
          <label className={OPTION}>
            <input type="radio" name="mode" value="for_sale" className="h-6 w-6" />
            <span>{t("seeds.mode.forSale")}</span>
          </label>
          <label className={OPTION}>
            <input type="radio" name="mode" value="trade" className="h-6 w-6" />
            <span>{t("seeds.mode.trade")}</span>
          </label>
          <label htmlFor="price" className={LABEL}>
            {t("seeds.price")}
          </label>
          <p className="text-sm text-text-muted">{t("seeds.priceHint")}</p>
          <input id="price" name="price" maxLength={80} className={FIELD} />
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="handover" className={LABEL}>
            {t("seeds.handover.legend")}
          </label>
          <select id="handover" name="handover" defaultValue="pickup" className={FIELD}>
            <option value="pickup">{t("seeds.handover.pickup")}</option>
            <option value="shipping">{t("seeds.handover.shipping")}</option>
            <option value="both">{t("seeds.handover.both")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="note" className={LABEL}>
            {t("seeds.note")}
          </label>
          <p className="text-sm text-text-muted">{t("seeds.noteHint")}</p>
          <textarea id="note" name="note" maxLength={280} rows={3} className={FIELD} />
        </div>

        <button type="submit" className={PRIMARY}>
          {t("seeds.submit")}
        </button>
      </form>
    </div>
  );
}
