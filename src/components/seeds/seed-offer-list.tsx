import Link from "next/link";
import { FormMessage } from "@/design-system/components/form-message";
import { StartConversation } from "@/components/messaging/start-conversation";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import {
  closeSeedOfferAction,
  expressSeedInterestAction,
  withdrawSeedInterestAction,
} from "@/modules/seeds/actions";
import type { OfferView, SourceKind } from "@/modules/seeds/repository";

/*
 * Seed and seedhead offers. The database decides what each reader may see, so this list only shows what it was given.
 * Interest, withdrawal and closing are offered only where they apply: a visitor is sent to sign in, the seller alone sees
 * who is interested and may close, and a grower may express or withdraw interest. A seed is never shown as a Seedling.
 */

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-base font-medium text-on-primary";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base text-text-brand";
const FIELD =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-text";

const NOTICE: Record<string, MessageKey> = {
  published: "seeds.notice.published",
  closed: "seeds.notice.closed",
  interestRecorded: "seeds.notice.interestRecorded",
  interestWithdrawn: "seeds.notice.interestWithdrawn",
};

export async function SeedOfferList({
  offers,
  viewerId,
  returnTo,
  signInHref,
  notice,
  failure,
}: {
  readonly offers: readonly OfferView[];
  readonly viewerId: string | null;
  readonly returnTo: string;
  readonly signInHref: string;
  readonly notice?: string;
  readonly failure?: string;
}) {
  const { t } = await getTranslation();

  return (
    <section aria-labelledby="seed-offers-title" className="flex flex-col gap-4">
      <h2 id="seed-offers-title" className="text-lg font-medium text-text">
        {t("seeds.list.title")}
      </h2>
      {notice && NOTICE[notice] ? (
        <FormMessage tone="success">{t(NOTICE[notice]!)}</FormMessage>
      ) : null}
      {failure ? <FormMessage tone="error">{t(failure as MessageKey)}</FormMessage> : null}
      {offers.length === 0 ? (
        <p className="text-base text-text-muted">{t("seeds.list.none")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {offers.map((offer) => {
            const mine = viewerId !== null && viewerId === offer.sellerId;
            return (
              <li
                key={offer.id}
                className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4"
              >
                <h3 className="text-base font-medium text-text">
                  {offer.materialType === "loose_seeds"
                    ? t("seeds.material.seeds")
                    : t("seeds.material.seedheads")}
                </h3>
                <p className="text-base text-text">
                  {offer.materialType === "loose_seeds"
                    ? `${t("seeds.packetSize")}: ${offer.packetSize}`
                    : `${t("seeds.seedheadCount")}: ${offer.seedheadCount}`}
                </p>
                <p className="text-base text-text">
                  {t(`seeds.mode.${modeKey(offer.mode)}` as MessageKey)}
                  {offer.priceText ? ` · ${offer.priceText}` : ""}
                  {" · "}
                  {t(`seeds.handover.${offer.handover}` as MessageKey)}
                </p>
                <p className="text-sm text-text-muted">
                  {t("seeds.list.from", { source: t(SOURCE[offer.sourceKind]) })}
                </p>
                {offer.sourceDescription ? (
                  <p className="text-base text-text">{offer.sourceDescription}</p>
                ) : null}
                {offer.note ? <p className="text-base text-text">{offer.note}</p> : null}
                {offer.photoUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {offer.photoUrls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt={t("seeds.sourcePhoto")}
                        className="h-32 w-32 rounded-control object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                {mine ? <p className="text-sm text-text-muted">{t("seeds.list.you")}</p> : null}

                {!offer.isActive ? (
                  <p className="text-base text-text-muted">{t("seeds.list.closed")}</p>
                ) : mine ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-text-muted">
                      {t("seeds.list.interestedCount", { count: String(offer.interested.length) })}
                    </p>
                    {offer.interested.length === 0 ? (
                      <p className="text-base text-text-muted">{t("seeds.list.noneInterested")}</p>
                    ) : (
                      <ul className="flex flex-col gap-1 text-base text-text">
                        {offer.interested.map((item) => (
                          <li key={item.userId} className="flex flex-col items-start gap-2">
                            <span>
                              {item.name}
                              {item.quantity ? ` · ${item.quantity}` : ""}
                            </span>
                            <StartConversation
                              kind="seedOffer"
                              target={offer.id}
                              other={item.userId}
                              returnTo={returnTo}
                              label={t("messaging.start.seedOffer")}
                              id={`start-offer-${offer.id}-${item.userId}`}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    <form action={closeSeedOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className={SECONDARY}>
                        {t("seeds.list.close")}
                      </button>
                    </form>
                  </div>
                ) : viewerId === null ? (
                  <Link href={signInHref} className={PRIMARY}>
                    {t("seeds.list.signIn")}
                  </Link>
                ) : offer.iAmInterested ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <StartConversation
                      kind="seedOffer"
                      target={offer.id}
                      other={offer.sellerId}
                      returnTo={returnTo}
                      label={t("messaging.start.seedOffer")}
                      id={`start-offer-${offer.id}`}
                    />
                    <form action={withdrawSeedInterestAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className={SECONDARY}>
                        {t("seeds.list.withdraw")}
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={expressSeedInterestAction} className="flex flex-col gap-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label htmlFor={`quantity-${offer.id}`} className="text-sm text-text-muted">
                      {t("seeds.list.quantity")}
                    </label>
                    <input
                      id={`quantity-${offer.id}`}
                      name="quantity"
                      maxLength={80}
                      className={FIELD}
                    />
                    <button type="submit" className={PRIMARY}>
                      {t("seeds.list.interest")}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const SOURCE: Record<SourceKind, MessageKey> = {
  seedling: "seeds.sourceName.seedling",
  cultivar: "seeds.sourceName.cultivar",
  unidentified: "seeds.sourceName.unidentified",
  unknown_mixed: "seeds.sourceName.unknownMixed",
};

function modeKey(mode: OfferView["mode"]): "free" | "forSale" | "trade" {
  return mode === "for_sale" ? "forSale" : mode;
}
