import { setCoverAction } from "@/modules/publications/actions";
import type { PublicImage, UpdateSummary } from "@/modules/publications/repository";
import { getTranslation } from "@/i18n/server";
import { SeedlingActions } from "./social-buttons";
import { PublicPhoto } from "./public-photo";
import { UpdateCard } from "./update-card";

/*
 * The public part of a seedling: its cover, the follow and save controls, and the journey of its Updates,
 * grouped by the year each observation was made. One seedling, one page, however many years it spans.
 */

export async function SeedlingJourney({
  seedlingId,
  title,
  cover,
  journey,
  isHolder,
  followed,
  saved,
}: {
  readonly seedlingId: string;
  readonly title: string;
  readonly cover: PublicImage | null;
  readonly journey: readonly UpdateSummary[];
  readonly isHolder: boolean;
  readonly followed: boolean;
  readonly saved: boolean;
}) {
  const { t } = await getTranslation();
  const returnTo = `/seedlings/${seedlingId}`;
  const byYear = new Map<number, UpdateSummary[]>();
  for (const update of journey) {
    const year = new Date(update.observedAt).getUTCFullYear();
    byYear.set(year, [...(byYear.get(year) ?? []), update]);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const photos = journey.flatMap((update) => update.images);

  return (
    <section aria-labelledby="journey-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {cover ? (
          <PublicPhoto
            image={cover}
            alt={t("publication.journey.coverAlt", { title })}
            className="max-h-[32rem]"
          />
        ) : (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            {t("publication.journey.noPhoto")}
          </p>
        )}
        <SeedlingActions
          seedlingId={seedlingId}
          followed={followed}
          saved={saved}
          returnTo={returnTo}
        />
      </div>

      <h2 id="journey-title" className="text-lg font-medium text-text">
        {t("publication.journey.title")}
      </h2>
      {years.length === 0 ? (
        <p className="text-base text-text-muted">
          {isHolder ? t("publication.journey.nothingYet") : t("publication.journey.noUpdates")}
        </p>
      ) : (
        years.map((year) => (
          <section key={year} aria-labelledby={`year-${year}`} className="flex flex-col gap-4">
            <h3 id={`year-${year}`} className="font-display text-2xl text-text-brand">
              {year}
            </h3>
            <ul className="flex flex-col gap-6">
              {(byYear.get(year) ?? []).map((update) => (
                <li key={update.updateId}>
                  <UpdateCard update={update} showSeedling={false} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {isHolder && photos.length > 0 ? (
        <details className="rounded-surface border border-border bg-surface p-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-base font-medium text-text-brand">
            {t("publication.journey.chooseCover")}
          </summary>
          <div className="flex flex-col gap-4 pt-4">
            <p className="text-base text-text-muted">{t("publication.journey.coverNote")}</p>
            <ul className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <form action={setCoverAction} className="flex flex-col gap-2">
                    <input type="hidden" name="seedlingId" value={seedlingId} />
                    <input type="hidden" name="derivativeId" value={photo.id} />
                    <PublicPhoto image={photo} alt={t("publication.journey.coverChoiceAlt")} />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-3 text-base text-text-brand"
                    >
                      {t("publication.journey.useCover")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={setCoverAction}>
              <input type="hidden" name="seedlingId" value={seedlingId} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand"
              >
                {t("publication.journey.useRecent")}
              </button>
            </form>
          </div>
        </details>
      ) : null}
    </section>
  );
}
