import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishForm } from "@/components/publications/publish-form";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { getObservation, mediaFor } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";
import { makeSeedlingPublicAction } from "@/modules/publications/actions";
import { isPubliclyShareable } from "@/modules/publications/limits";
import { getSeedling } from "@/modules/seedlings/repository";

export const metadata: Metadata = { title: "Share" };

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
      Back to the observation
    </Link>
  );

  if (!isHolder) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-3xl leading-tight text-text-brand">
          Share this observation
        </h1>
        <FormMessage tone="error">
          Only the current holder of this seedling can share it.
        </FormMessage>
        {back}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight text-text-brand">
          Share this observation
        </h1>
        <p className="text-base text-text-muted">
          Sharing creates a public Update. Only the photos you choose are shared, and the
          observation itself stays private.
        </p>
      </header>

      {query.public === "1" ? (
        <FormMessage tone="success">
          The seedling is public now. Choose the photos you want to share.
        </FormMessage>
      ) : null}
      {query.error === "seedling" ? (
        <FormMessage tone="error">
          The seedling could not be made public. Nothing has changed.
        </FormMessage>
      ) : null}

      {images.length === 0 ? (
        <section aria-labelledby="no-images-title" className="flex flex-col gap-3">
          <h2 id="no-images-title" className="text-lg font-medium text-text">
            {videoCount > 0 ? "Public video sharing isn't available yet" : "Nothing to share yet"}
          </h2>
          <p className="text-base text-text-muted">
            {videoCount > 0
              ? "This observation holds only video, and video stays private for now. Your video is kept safely and is not published."
              : "This observation has no photos to share."}
          </p>
        </section>
      ) : seedling.visibility === "private" ? (
        <section
          aria-labelledby="make-public-title"
          className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
        >
          <h2 id="make-public-title" className="text-lg font-medium text-text">
            Make this seedling public to share it
          </h2>
          <p className="text-base text-text">
            This seedling is private, and a public Update needs a public seedling page for visitors
            to open.
          </p>
          <p className="text-base text-text-muted">
            Continuing changes only the seedling&apos;s visibility to public. Your observations,
            notes, transcripts and original photos stay private.
          </p>
          <form action={makeSeedlingPublicAction} className="flex flex-col gap-3">
            <input type="hidden" name="observationId" value={id} />
            <SubmitButton pendingLabel="Making public…">
              Make Seedling public &amp; continue
            </SubmitButton>
          </form>
          <p className="text-sm text-text-muted">
            To keep this private, leave this page. Nothing has changed.
          </p>
        </section>
      ) : (
        <PublishForm
          observationId={id}
          clientKey={crypto.randomUUID()}
          images={images.map((item) => ({
            id: item.id,
            label: `photo ${item.sortOrder + 1}`,
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
