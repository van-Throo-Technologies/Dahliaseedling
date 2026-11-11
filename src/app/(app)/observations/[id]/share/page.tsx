import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishForm } from "@/components/publications/publish-form";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";
import { getObservation, mediaFor } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { makeSeedlingPublicAction } from "@/modules/publications/actions";
import { isPubliclyShareable } from "@/modules/publications/limits";
import { getSeedling } from "@/modules/seedlings/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("publication.share.title") };
}

/*
 * Share is deliberate. It works in order: the current holder, the seedling's visibility, then the choice of
 * photos. Opening this page changes nothing. A private seedling becomes public only when the grower presses
 * the explicit button, and that button changes the seedling's visibility and nothing else.
 */
export default async function SharePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ public?: string; error?: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const query = await searchParams;
  const { userId } = await requireParticipant(`/observations/${id}/share`);
  const { t } = await getTranslation();

  const supabase = await createSupabaseServerClient();
  const observation = await getObservation(supabase, id);
  if (!observation) notFound();
  const seedling = await getSeedling(supabase, observation.seedlingId);
  if (!seedling) notFound();

  const media = (await mediaFor(supabase, [id])).get(id) ?? [];
  const images = media.filter((item) => item.kind === "image");
  const videoCount = media.length - images.length;
  const isHolder = seedling.currentHolderId === userId;
  const back = (
    <Link href={`/observations/${id}`} className="text-base text-text-brand">
      {t("publication.share.back")}
    </Link>
  );

  if (!isHolder) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-3xl leading-tight text-text-brand">
          {t("publication.share.title")}
        </h1>
        <FormMessage tone="error">{t("publication.share.holderOnly")}</FormMessage>
        {back}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight text-text-brand">
          {t("publication.share.title")}
        </h1>
        <p className="text-base text-text-muted">{t("publication.share.intro")}</p>
      </header>

      {query.public === "1" ? (
        <FormMessage tone="success">{t("publication.share.publicNow")}</FormMessage>
      ) : null}
      {query.error === "seedling" ? (
        <FormMessage tone="error">{t("publication.share.makePublicError")}</FormMessage>
      ) : null}

      {images.length === 0 ? (
        <section aria-labelledby="no-images-title" className="flex flex-col gap-3">
          <h2 id="no-images-title" className="text-lg font-medium text-text">
            {videoCount > 0
              ? t("publication.share.videoTitle")
              : t("publication.share.nothingTitle")}
          </h2>
          <p className="text-base text-text-muted">
            {videoCount > 0 ? t("publication.share.videoText") : t("publication.share.nothingText")}
          </p>
        </section>
      ) : seedling.visibility === "private" ? (
        <section
          aria-labelledby="make-public-title"
          className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
        >
          <h2 id="make-public-title" className="text-lg font-medium text-text">
            {t("publication.share.makePublicTitle")}
          </h2>
          <p className="text-base text-text">{t("publication.share.makePublicWhy")}</p>
          <p className="text-base text-text-muted">{t("publication.share.makePublicWhat")}</p>
          <form action={makeSeedlingPublicAction} className="flex flex-col gap-3">
            <input type="hidden" name="observationId" value={id} />
            <SubmitButton pendingLabel={t("publication.share.makePublicPending")}>
              {t("publication.share.makePublicButton")}
            </SubmitButton>
          </form>
          <p className="text-sm text-text-muted">{t("publication.share.makePublicKeep")}</p>
        </section>
      ) : (
        <PublishForm
          observationId={id}
          clientKey={crypto.randomUUID()}
          images={images.map((item) => ({
            id: item.id,
            label: t("publication.publish.photoLabel", { number: item.sortOrder + 1 }),
            mime: item.mimeType,
            shareable: isPubliclyShareable(item.mimeType),
          }))}
          videoCount={videoCount}
        />
      )}

      {back}
    </div>
  );
}
