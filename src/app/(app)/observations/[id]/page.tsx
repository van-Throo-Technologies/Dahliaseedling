import type { Metadata } from "next";
import { photoSrc } from "@/modules/capture/media-type";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteObservationForm } from "@/components/capture/delete-observation-form";
import { LocalTime } from "@/components/capture/local-time";
import { MediaPreview } from "@/components/capture/media-preview";
import { ObservationNoteForm } from "@/components/capture/observation-note-form";
import { FormMessage } from "@/design-system/components/form-message";
import { ButtonLink } from "@/design-system/components/button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { getOwnProfile } from "@/modules/identity/session";
import { getObservation, mediaFor } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { labelWords } from "@/modules/seedlings/labels";
import { displayIdentifier, getSeedling, listIdentifiers } from "@/modules/seedlings/repository";

// An observation is private to its author. Anyone else, and a missing observation, get the same 404.

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("capture.observation.metaTitle") };
}

export default async function ObservationPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ saved?: string; moved?: string; deleteFailed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const { t } = await getTranslation();
  const words = labelWords(t);

  const supabase = await createSupabaseServerClient();
  const observation = await getObservation(supabase, id);
  if (!observation) notFound();

  const profile = await getOwnProfile();
  const canEdit = profile !== null && !profile.isSuspended;

  const [media, seedling] = await Promise.all([
    mediaFor(supabase, [id]),
    getSeedling(supabase, observation.seedlingId),
  ]);
  const items = media.get(id) ?? [];
  const identifiers = seedling ? await listIdentifiers(supabase, seedling.id) : [];
  const seedlingTitle = seedling ? displayIdentifier(identifiers, words) : null;
  const savedMessage = seedlingTitle
    ? `${t("capture.observation.savedPrivately")} ${t("capture.observation.addedTo", { seedling: seedlingTitle })} ${t("capture.observation.nothingShared")}`
    : `${t("capture.observation.savedPrivately")} ${t("capture.observation.nothingShared")}`;

  return (
    <article aria-labelledby="observation-title" className="flex flex-col gap-6">
      {query.saved === "1" ? <FormMessage tone="success">{savedMessage}</FormMessage> : null}
      {query.moved === "1" ? (
        <FormMessage tone="success">{t("capture.move.moved")}</FormMessage>
      ) : null}
      {query.deleteFailed === "1" ? (
        <FormMessage tone="error">{t("errors.capture.notDeleted")}</FormMessage>
      ) : null}

      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text-muted">{t("capture.observation.private")}</p>
        <h1 id="observation-title" className="font-display text-2xl text-text-brand">
          {t("capture.observation.observed")} <LocalTime iso={observation.observedAt} />
        </h1>
        {seedling && seedlingTitle ? (
          <p className="text-base text-text">
            <Link
              href={`/seedlings/${seedling.id}`}
              className="text-text-brand underline underline-offset-4"
            >
              {t("capture.observation.on", { seedling: seedlingTitle })}
            </Link>
          </p>
        ) : (
          <p className="text-base text-text-muted">{t("capture.observation.notVisible")}</p>
        )}
      </header>

      {items.length > 0 ? (
        <ul
          aria-label={t("capture.observation.photos")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {items.map((item) => (
            <li key={item.id}>
              <MediaPreview
                src={photoSrc(item.id, item.mimeType)}
                mime={item.mimeType}
                label={t("capture.observation.yourPhoto")}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {observation.note ? (
        <section aria-labelledby="note-title" className="flex flex-col gap-2">
          <h2 id="note-title" className="text-lg font-medium text-text">
            {t("capture.observation.note")}
          </h2>
          <p className="whitespace-pre-line text-base text-text">{observation.note}</p>
        </section>
      ) : null}

      {canEdit ? (
        <section aria-labelledby="edit-title" className="flex flex-col gap-4">
          <h2 id="edit-title" className="text-lg font-medium text-text">
            {t("capture.observation.addNote")}
          </h2>
          <ObservationNoteForm observationId={id} defaultNote={observation.note ?? ""} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`/observations/${id}/move`} variant="secondary">
              {t("capture.observation.change")}
            </ButtonLink>
          </div>
        </section>
      ) : (
        <p className="rounded-surface border border-border bg-surface p-4 text-base text-text">
          {t("capture.observation.suspended")}
        </p>
      )}

      <section aria-labelledby="share-title" className="flex flex-col gap-2">
        <h2 id="share-title" className="text-lg font-medium text-text">
          {t("capture.observation.share")}
        </h2>
        {canEdit ? (
          <ButtonLink href={`/observations/${id}/share`} variant="secondary">
            {t("capture.observation.shareSelected")}
          </ButtonLink>
        ) : null}
        <p id="share-note" className="text-sm text-text-muted">
          {t("capture.observation.shareNote")}
        </p>
      </section>

      {canEdit ? <DeleteObservationForm observationId={id} /> : null}
    </article>
  );
}
