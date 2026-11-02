import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteObservationForm } from "@/components/capture/delete-observation-form";
import { LocalTime } from "@/components/capture/local-time";
import { MediaPreview } from "@/components/capture/media-preview";
import { ObservationNoteForm } from "@/components/capture/observation-note-form";
import { FormMessage } from "@/design-system/components/form-message";
import { ButtonLink } from "@/design-system/components/button-link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/modules/identity/session";
import { getObservation, mediaFor } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { displayIdentifier, getSeedling, listIdentifiers } from "@/modules/seedlings/repository";

// An observation is private to its author. Anyone else, and a missing observation, get the same 404.

export const metadata: Metadata = { title: "Observation" };

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
  const seedlingTitle = seedling ? displayIdentifier(identifiers) : null;
  const savedMessage = `Saved privately.${seedlingTitle ? ` Added to ${seedlingTitle}.` : ""} Nothing is shared.`;

  return (
    <article aria-labelledby="observation-title" className="flex flex-col gap-6">
      {query.saved === "1" ? <FormMessage tone="success">{savedMessage}</FormMessage> : null}
      {query.moved === "1" ? (
        <FormMessage tone="success">Moved. The photos were not uploaded again.</FormMessage>
      ) : null}
      {query.deleteFailed === "1" ? (
        <FormMessage tone="error">That observation could not be deleted. Try again.</FormMessage>
      ) : null}

      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text-muted">Private</p>
        <h1 id="observation-title" className="font-display text-2xl text-text-brand">
          Observed <LocalTime iso={observation.observedAt} />
        </h1>
        {seedling && seedlingTitle ? (
          <p className="text-base text-text">
            On{" "}
            <Link
              href={`/seedlings/${seedling.id}`}
              className="text-text-brand underline underline-offset-4"
            >
              {seedlingTitle}
            </Link>
          </p>
        ) : (
          <p className="text-base text-text-muted">
            This seedling is not visible to you at the moment.
          </p>
        )}
      </header>

      {items.length > 0 ? (
        <ul aria-label="Photos and videos" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <MediaPreview
                src={`/media/${item.id}`}
                mime={item.mimeType}
                label="Your private photo or video"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {observation.note ? (
        <section aria-labelledby="note-title" className="flex flex-col gap-2">
          <h2 id="note-title" className="text-lg font-medium text-text">
            Note
          </h2>
          <p className="whitespace-pre-line text-base text-text">{observation.note}</p>
        </section>
      ) : null}

      {canEdit ? (
        <section aria-labelledby="edit-title" className="flex flex-col gap-4">
          <h2 id="edit-title" className="text-lg font-medium text-text">
            Add or change the note
          </h2>
          <ObservationNoteForm observationId={id} defaultNote={observation.note ?? ""} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={`/observations/${id}/move`} variant="secondary">
              Change seedling
            </ButtonLink>
          </div>
        </section>
      ) : (
        <p className="rounded-surface border border-border bg-surface p-4 text-base text-text">
          Your account is suspended, so you can read this observation but cannot change it.
        </p>
      )}

      <section aria-labelledby="share-title" className="flex flex-col gap-2">
        <h2 id="share-title" className="text-lg font-medium text-text">
          Share
        </h2>
        <button
          type="button"
          disabled
          aria-describedby="share-note"
          className="min-h-11 w-full rounded-control border border-border bg-surface px-4 text-base text-text-muted sm:w-auto"
        >
          Share (coming with Updates)
        </button>
        <p id="share-note" className="text-sm text-text-muted">
          Sharing will create a public Update, which comes later. Until then, this observation stays
          private.
        </p>
      </section>

      {canEdit ? <DeleteObservationForm observationId={id} /> : null}
    </article>
  );
}
