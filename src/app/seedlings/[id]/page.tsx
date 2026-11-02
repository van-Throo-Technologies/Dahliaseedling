import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachSeriesForm } from "@/components/seedlings/attach-series-form";
import { ParentForm } from "@/components/seedlings/parent-form";
import { SeedlingEditForm } from "@/components/seedlings/seedling-edit-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, getOwnProfile } from "@/modules/identity/session";
import {
  displayIdentifier,
  displayLabels,
  displayNames,
  getSeedling,
  workingNames,
  listIdentifiers,
  listParentage,
  listProvenance,
  listSeries,
  attachedSeriesIds,
} from "@/modules/seedlings/repository";
import {
  formatDate,
  patternUsesYear,
  roleLabel,
  visibilityLabel,
} from "@/modules/seedlings/presentation";
import { isUuid } from "@/modules/seedlings/validation";
import { listObservationsForSeedling, mediaFor } from "@/modules/capture/repository";
import { LocalTime } from "@/components/capture/local-time";
import { MediaPreview } from "@/components/capture/media-preview";

// A seedling is addressed by its uuid. A private seedling, a missing one and a malformed id all produce
// the same 404, so the existence of a private seedling is never revealed.

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Seedling not found" };
  const supabase = await createSupabaseServerClient();
  const seedling = await getSeedling(supabase, id);
  if (!seedling) return { title: "Seedling not found" };
  const identifiers = await listIdentifiers(supabase, id);
  return { title: seedling.workingName ?? displayIdentifier(identifiers) };
}

export default async function SeedlingPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const seedling = await getSeedling(supabase, id);
  if (!seedling) notFound();

  const viewer = await getCurrentUser();
  const isHolder = viewer !== null && viewer.id === seedling.currentHolderId;
  const isOriginatorOnly = viewer !== null && viewer.id === seedling.originatorId && !isHolder;
  const ownProfile = isHolder ? await getOwnProfile() : null;
  const canEdit = isHolder && ownProfile !== null && !ownProfile.isSuspended;
  const isSuspendedHolder = isHolder && ownProfile?.isSuspended === true;

  const [identifiers, parentage, provenance, names] = await Promise.all([
    listIdentifiers(supabase, id),
    listParentage(supabase, id),
    listProvenance(supabase, id),
    displayNames(supabase, [seedling.originatorId, seedling.currentHolderId]),
  ]);
  const parentLabels = await displayLabels(
    supabase,
    parentage.flatMap((link) => (link.parentSeedlingId ? [link.parentSeedlingId] : [])),
  );

  const parentNames = await workingNames(
    supabase,
    parentage.flatMap((link) => (link.parentSeedlingId ? [link.parentSeedlingId] : [])),
  );
  const parentDisplay = (parentId: string): string => {
    const label = parentLabels.get(parentId) ?? "Seedling";
    const name = parentNames.get(parentId);
    return name ? `${name} · ${label}` : label;
  };

  // Only the author's own observations are returned: RLS hides everyone else's, including a visitor's,
  // whatever the seedling's visibility.
  const observations = await listObservationsForSeedling(supabase, id);
  const observationMedia = await mediaFor(
    supabase,
    observations.map((item) => item.id),
  );

  const title = displayIdentifier(identifiers);
  const originator = names.get(seedling.originatorId);
  const holder = names.get(seedling.currentHolderId);

  // Management data is loaded only for the holder.
  const series = canEdit ? (await listSeries(supabase)).filter((item) => item.active) : [];
  const attached = canEdit ? new Set(await attachedSeriesIds(supabase, id)) : new Set<string>();
  const attachable = series.filter((item) => !attached.has(item.id));
  const yearNeeded = attachable.some((item) => patternUsesYear(item.pattern));
  const parentDefaults = (role: "seed_parent" | "pollen_parent") => {
    const current = parentage.find((link) => link.role === role);
    const parentSeedlingId = current?.parentSeedlingId ?? "";
    return {
      kind: current
        ? current.isUnknown
          ? ("unknown" as const)
          : parentSeedlingId
            ? ("seedling" as const)
            : ("cultivar" as const)
        : ("none" as const),
      parentSeedlingId,
      parentLabel: parentSeedlingId ? parentDisplay(parentSeedlingId) : "",
      cultivarName: current?.cultivarName ?? "",
      notes: current?.notes ?? "",
    };
  };

  return (
    <article className="flex flex-col gap-8" aria-labelledby="seedling-title">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text-muted">
          {visibilityLabel(seedling.visibility)}
        </p>
        <h1 id="seedling-title" className="font-display text-3xl leading-tight text-text-brand">
          {seedling.workingName ?? title}
        </h1>
        {seedling.workingName ? <p className="text-lg text-text-muted">{title}</p> : null}
      </header>

      {isSuspendedHolder ? (
        <p className="rounded-surface border border-destructive p-4 text-base text-destructive">
          Your account is suspended, so this seedling is read-only for you.
        </p>
      ) : null}

      {isOriginatorOnly ? (
        <p className="rounded-surface border border-border bg-surface p-4 text-base text-text">
          You originated this seedling, so you can read its record. It is now grown by{" "}
          {holder ?? "its current grower"}, who alone can change it.
        </p>
      ) : null}

      <section aria-labelledby="facts-title" className="flex flex-col gap-3">
        <h2 id="facts-title" className="text-lg font-medium text-text">
          About this seedling
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          {seedling.firstGrownYear ? (
            <>
              <dt className="text-text-muted">First grown</dt>
              <dd className="text-text">{seedling.firstGrownYear}</dd>
            </>
          ) : null}
          {originator ? (
            <>
              <dt className="text-text-muted">Originated by</dt>
              <dd className="text-text">
                <Link
                  href={`/profiles/${seedling.originatorId}`}
                  className="text-text-brand underline underline-offset-4"
                >
                  {originator}
                </Link>
              </dd>
            </>
          ) : null}
          {holder ? (
            <>
              <dt className="text-text-muted">Currently grown by</dt>
              <dd className="text-text">
                <Link
                  href={`/profiles/${seedling.currentHolderId}`}
                  className="text-text-brand underline underline-offset-4"
                >
                  {holder}
                </Link>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="identifiers-title" className="flex flex-col gap-3">
        <h2 id="identifiers-title" className="text-lg font-medium text-text">
          Identifiers
        </h2>
        <ul className="flex flex-col gap-2">
          {identifiers.map((identifier) => (
            <li
              key={`${identifier.kind}-${identifier.identifier}`}
              className="flex flex-wrap items-center gap-2 text-base text-text"
            >
              <span className="font-medium">
                {identifier.kind === "automatic"
                  ? `#${identifier.identifier}`
                  : identifier.identifier}
              </span>
              <span className="text-sm text-text-muted">
                {identifier.kind === "automatic" ? "automatic number" : "series identifier"}
                {identifier.isPrimary && !identifier.isRetiredAlias ? " · shown first" : ""}
                {identifier.isRetiredAlias ? " · retired, still refers to this seedling" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {parentage.length > 0 || canEdit ? (
        <section aria-labelledby="parentage-title" className="flex flex-col gap-3">
          <h2 id="parentage-title" className="text-lg font-medium text-text">
            Parentage
          </h2>
          {parentage.length === 0 ? (
            <p className="text-base text-text-muted">Not recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {parentage.map((link) => (
                <li key={link.role} className="flex flex-col gap-1 text-base text-text">
                  <span className="text-text-muted">{roleLabel(link.role)}</span>
                  {link.isUnknown ? (
                    <span>Unknown</span>
                  ) : link.parentSeedlingId ? (
                    <Link
                      href={`/seedlings/${link.parentSeedlingId}`}
                      className="text-text-brand underline underline-offset-4"
                    >
                      {parentDisplay(link.parentSeedlingId)}
                    </Link>
                  ) : (
                    <span>{link.cultivarName}</span>
                  )}
                  {link.notes ? (
                    <span className="text-sm text-text-muted">{link.notes}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-medium text-text">
          History
        </h2>
        <ul className="flex flex-col gap-2 text-base text-text">
          {provenance.map((event) => (
            <li key={event.occurredAt}>
              {event.eventType === "originated" ? "Originated" : "Recorded"} on{" "}
              {formatDate(event.occurredAt)}
              {event.eventType === "originated" && originator ? ` by ${originator}` : ""}
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-muted">Added on {formatDate(seedling.createdAt)}</p>
      </section>

      {observations.length > 0 ? (
        <section aria-labelledby="observations-title" className="flex flex-col gap-4">
          <h2 id="observations-title" className="text-lg font-medium text-text">
            Your private observations
          </h2>
          <p className="text-sm text-text-muted">
            Only you can see these. They are not shared with visitors or other growers.
          </p>
          <ul className="flex flex-col gap-4">
            {observations.map((item) => {
              const first = observationMedia.get(item.id)?.[0];
              return (
                <li key={item.id}>
                  <Link
                    href={`/observations/${item.id}`}
                    className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4 no-underline"
                  >
                    {first ? (
                      <div className="w-24">
                        <MediaPreview
                          src={`/media/${first.id}`}
                          mime={first.mimeType}
                          label="Private photo or video"
                        />
                      </div>
                    ) : null}
                    <span className="text-base font-medium text-text-brand">
                      Observed <LocalTime iso={item.observedAt} />
                    </span>
                    {item.note ? (
                      <span className="line-clamp-2 text-base text-text">{item.note}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canEdit ? (
        <section aria-labelledby="manage-title" className="flex flex-col gap-6">
          <h2 id="manage-title" className="text-lg font-medium text-text">
            Manage this seedling
          </h2>

          {!seedling.firstGrownYear && yearNeeded ? (
            <p className="rounded-surface border border-border bg-surface p-4 text-base text-text">
              Add the first grown year to number this seedling with a year-based series, such as
              JV-26-001. The seedling already has its automatic number, and nothing is lost by
              waiting.
            </p>
          ) : null}

          {attachable.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4">
              <AttachSeriesForm
                seedlingId={id}
                series={attachable.map((item) => ({
                  id: item.id,
                  label: patternUsesYear(item.pattern)
                    ? `Series ${item.name} (uses the year)`
                    : `Series ${item.name}`,
                }))}
              />
            </div>
          ) : null}

          <SeedlingEditForm
            seedlingId={id}
            defaults={{
              workingName: seedling.workingName ?? "",
              firstGrownYear: seedling.firstGrownYear ? String(seedling.firstGrownYear) : "",
              visibility: seedling.visibility,
            }}
          />
          <ParentForm
            seedlingId={id}
            role="seed_parent"
            heading="Seed parent"
            defaults={parentDefaults("seed_parent")}
          />
          <ParentForm
            seedlingId={id}
            role="pollen_parent"
            heading="Pollen parent"
            defaults={parentDefaults("pollen_parent")}
          />
        </section>
      ) : null}
    </article>
  );
}
