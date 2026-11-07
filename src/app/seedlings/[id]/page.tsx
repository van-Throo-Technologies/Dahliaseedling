import type { Metadata } from "next";
import { photoSrc } from "@/modules/capture/media-type";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AttachSeriesForm } from "@/components/seedlings/attach-series-form";
import { ParentForm } from "@/components/seedlings/parent-form";
import { FormMessage } from "@/design-system/components/form-message";
import { AvailabilityControl } from "@/components/messaging/availability-control";
import { MessagingFeedback } from "@/components/messaging/feedback-message";
import { StartConversation } from "@/components/messaging/start-conversation";
import { RehomePanel } from "@/components/rehome/rehome-panel";
import { SeedOfferList } from "@/components/seeds/seed-offer-list";
import {
  listMyUnidentifiedSources,
  offersForSeedling,
  unidentifiedDescription,
} from "@/modules/seeds/repository";
import { SeedlingEditForm } from "@/components/seedlings/seedling-edit-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { formatDate } from "@/i18n/format";
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
import { labelWords } from "@/modules/seedlings/labels";
import { patternUsesYear } from "@/modules/seedlings/presentation";
import { isUuid } from "@/modules/seedlings/validation";
import { listObservationsForSeedling, mediaFor } from "@/modules/capture/repository";
import { LocalTime } from "@/components/capture/local-time";
import { SeedlingJourney } from "@/components/publications/seedling-journey";
import { listSeedlingJourney, seedlingCover, socialState } from "@/modules/publications/repository";
import { MediaPreview } from "@/components/capture/media-preview";

// A seedling is addressed by its uuid. A private seedling, a missing one and a malformed id all produce
// the same 404, so the existence of a private seedling is never revealed.

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { t } = await getTranslation();
  const { id } = await params;
  if (!isUuid(id)) return { title: t("errors.notFound") };
  const supabase = await createSupabaseServerClient();
  const seedling = await getSeedling(supabase, id);
  if (!seedling) return { title: t("errors.notFound") };
  const identifiers = await listIdentifiers(supabase, id);
  const title = displayIdentifier(identifiers, labelWords(t)) || t("glossary.seedling");
  return { title: seedling.workingName ?? title };
}

export default async function SeedlingPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{
    rehome?: string;
    rehomeError?: string;
    mergeNotice?: string;
    messagingNotice?: string;
    messagingError?: string;
    seedNotice?: string;
    seedError?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!isUuid(id)) notFound();
  const { t, locale } = await getTranslation();
  const words = labelWords(t);

  const supabase = await createSupabaseServerClient();
  const seedling = await getSeedling(supabase, id);
  if (!seedling) {
    // A retired merged identity leads to its canonical Seedling, never to a second page for the same plant.
    const { data: canonical } = await supabase.rpc("seedling_canonical_id", { p_seedling_id: id });
    if (canonical) redirect(`/seedlings/${canonical}`);
    notFound();
  }

  const viewer = await getCurrentUser();
  const isHolder = viewer !== null && viewer.id === seedling.currentHolderId;
  const isOriginatorOnly = viewer !== null && viewer.id === seedling.originatorId && !isHolder;
  const ownProfile = isHolder ? await getOwnProfile() : null;
  const canEdit = isHolder && ownProfile !== null && !ownProfile.isSuspended;
  const isSuspendedHolder = isHolder && ownProfile?.isSuspended === true;

  // The public part of a seedling (its cover, follow and save, and its journey) exists only while the seedling is
  // public. A private seedling shows none of it, to anyone but its holder.
  const publicPart = seedling.visibility === "public";
  const journey = publicPart ? await listSeedlingJourney(supabase, id) : [];
  const cover = publicPart ? await seedlingCover(supabase, id) : null;
  const social =
    publicPart && viewer
      ? await socialState(supabase, viewer.id, id, seedling.currentHolderId)
      : null;

  const [identifiers, parentage, provenance, names] = await Promise.all([
    listIdentifiers(supabase, id),
    listParentage(supabase, id),
    listProvenance(supabase, id),
    displayNames(supabase, [seedling.originatorId, seedling.currentHolderId]),
  ]);
  const transferNames = await displayNames(
    supabase,
    provenance.flatMap((event) => (event.toHolderId ? [event.toHolderId] : [])),
  );
  // The unidentified dahlia's description is shown only where the reader may see it; otherwise the bare label.
  const unidentifiedTexts = new Map(
    await Promise.all(
      parentage
        .flatMap((link) => (link.unidentifiedSourceId ? [link.unidentifiedSourceId] : []))
        .map(
          async (sourceId) =>
            [sourceId, await unidentifiedDescription(supabase, sourceId)] as const,
        ),
    ),
  );
  const subscribed =
    viewer !== null && publicPart && !isHolder
      ? (
          await supabase
            .from("availability_subscriptions")
            .select("seedling_id")
            .eq("seedling_id", id)
            .is("closed_at", null)
            .maybeSingle()
        ).data !== null
      : false;
  const seedOffers = await offersForSeedling(supabase, id, viewer?.id ?? null);
  // A stored parent reference may point at a retired merged identity. The stored reference is not changed; only what is shown
  // resolves to the canonical Seedling, and only where the viewer could see that canonical Seedling anyway.
  const parentIds = parentage.flatMap((link) =>
    link.parentSeedlingId ? [link.parentSeedlingId] : [],
  );
  const canonicalParent = new Map<string, string>();
  for (const parentId of parentIds) {
    const { data: canonical } = await supabase.rpc("seedling_canonical_id", {
      p_seedling_id: parentId,
    });
    if (canonical) canonicalParent.set(parentId, canonical);
  }
  const shownParentId = (parentId: string): string => canonicalParent.get(parentId) ?? parentId;
  const parentLabels = await displayLabels(supabase, parentIds.map(shownParentId), words);

  const parentNames = await workingNames(supabase, parentIds.map(shownParentId));
  const parentDisplay = (parentId: string): string => {
    const shown = shownParentId(parentId);
    const label = parentLabels.get(shown) ?? words.seedling;
    const name = parentNames.get(shown);
    return name ? `${name} · ${label}` : label;
  };

  // Only the author's own observations are returned: RLS hides everyone else's, including a visitor's,
  // whatever the seedling's visibility.
  const observations = await listObservationsForSeedling(supabase, id);
  const observationMedia = await mediaFor(
    supabase,
    observations.map((item) => item.id),
  );

  const title = displayIdentifier(identifiers, words) || words.seedling;
  const originator = names.get(seedling.originatorId);
  const holder = names.get(seedling.currentHolderId);

  // Management data is loaded only for the holder.
  const series = canEdit ? (await listSeries(supabase)).filter((item) => item.active) : [];
  // The grower's own unidentified sources, offered for reuse in the parentage form. Only the holder can change parentage.
  const unidentifiedChoices = canEdit
    ? (await listMyUnidentifiedSources(supabase)).map((source) => ({
        id: source.id,
        label: source.description ?? t("seeds.parentage.noDescription"),
      }))
    : [];
  const attached = canEdit ? new Set(await attachedSeriesIds(supabase, id)) : new Set<string>();
  const attachable = series.filter((item) => !attached.has(item.id));
  const yearNeeded = attachable.some((item) => patternUsesYear(item.pattern));
  const parentDefaults = (role: "seed_parent" | "pollen_parent") => {
    const current = parentage.find((link) => link.role === role);
    const parentSeedlingId = current?.parentSeedlingId ?? "";
    return {
      kind: current
        ? current.unidentifiedSourceId
          ? ("unidentified" as const)
          : current.isUnknown
            ? ("unknown" as const)
            : parentSeedlingId
              ? ("seedling" as const)
              : ("cultivar" as const)
        : ("none" as const),
      parentSeedlingId,
      parentLabel: parentSeedlingId ? parentDisplay(parentSeedlingId) : "",
      cultivarName: current?.cultivarName ?? "",
      unidentifiedSourceId: current?.unidentifiedSourceId ?? "",
      notes: current?.notes ?? "",
    };
  };
  const visibilityText =
    seedling.visibility === "public" ? t("glossary.public") : t("glossary.private");

  return (
    <article className="flex flex-col gap-8" aria-labelledby="seedling-title">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-text-muted">{visibilityText}</p>
        <h1 id="seedling-title" className="font-display text-3xl leading-tight text-text-brand">
          {seedling.workingName ?? title}
        </h1>
        {seedling.workingName ? <p className="text-lg text-text-muted">{title}</p> : null}
      </header>

      {publicPart ? (
        <SeedlingJourney
          seedlingId={id}
          title={seedling.workingName ?? title}
          cover={cover}
          journey={journey}
          isHolder={isHolder}
          followed={social?.followsSeedling ?? false}
          saved={social?.savedSeedling ?? false}
        />
      ) : null}

      {isSuspendedHolder ? (
        <p className="rounded-surface border border-destructive p-4 text-base text-destructive">
          {t("seedlings.page.suspendedHolder")}
        </p>
      ) : null}

      {isOriginatorOnly ? (
        <p className="rounded-surface border border-border bg-surface p-4 text-base text-text">
          {t("seedlings.page.originatedNotHolder", {
            holder: holder ?? t("seedlings.page.currentGrowerFallback"),
          })}
        </p>
      ) : null}

      <section aria-labelledby="facts-title" className="flex flex-col gap-3">
        <h2 id="facts-title" className="text-lg font-medium text-text">
          {t("seedlings.page.about")}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          {seedling.firstGrownYear ? (
            <>
              <dt className="text-text-muted">{t("seedlings.page.firstGrown")}</dt>
              <dd className="text-text">{seedling.firstGrownYear}</dd>
            </>
          ) : null}
          {originator ? (
            <>
              <dt className="text-text-muted">{t("glossary.originator")}</dt>
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
              <dt className="text-text-muted">{t("glossary.currentGrower")}</dt>
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
          {t("seedlings.page.identifiers")}
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
                {identifier.kind === "automatic"
                  ? t("seedlings.page.automaticNumber")
                  : t("seedlings.page.seriesIdentifier")}
                {identifier.isPrimary && !identifier.isRetiredAlias
                  ? ` · ${t("seedlings.page.shownFirst")}`
                  : ""}
                {identifier.isRetiredAlias ? ` · ${t("seedlings.page.retired")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {parentage.length > 0 || canEdit ? (
        <section aria-labelledby="parentage-title" className="flex flex-col gap-3">
          <h2 id="parentage-title" className="text-lg font-medium text-text">
            {t("seedlings.page.parentage")}
          </h2>
          {parentage.length === 0 ? (
            <p className="text-base text-text-muted">{t("glossary.parentNotRecorded")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {parentage.map((link) => (
                <li key={link.role} className="flex flex-col gap-1 text-base text-text">
                  <span className="text-text-muted">
                    {link.role === "seed_parent"
                      ? t("glossary.seedParent")
                      : t("glossary.pollenParent")}
                  </span>
                  {link.isUnknown ? (
                    <span>{t("glossary.unknownParent")}</span>
                  ) : link.parentSeedlingId ? (
                    <Link
                      href={`/seedlings/${shownParentId(link.parentSeedlingId)}`}
                      className="text-text-brand underline underline-offset-4"
                    >
                      {parentDisplay(link.parentSeedlingId)}
                    </Link>
                  ) : link.unidentifiedSourceId ? (
                    <span>
                      {unidentifiedTexts.get(link.unidentifiedSourceId)
                        ? t("seeds.parentage.description", {
                            description: unidentifiedTexts.get(link.unidentifiedSourceId) ?? "",
                          })
                        : t("seeds.parentage.unidentified")}
                    </span>
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

      {seedOffers.length > 0 || canEdit || query.seedNotice || query.seedError ? (
        <div className="flex flex-col gap-4">
          {canEdit ? (
            <Link
              href={`/offers/new?seedling=${id}`}
              className="inline-flex min-h-11 items-center justify-center self-start rounded-control border border-border bg-surface px-4 text-base text-text-brand"
            >
              {t("seeds.offerNew")}
            </Link>
          ) : null}
          <SeedOfferList
            offers={seedOffers}
            viewerId={viewer?.id ?? null}
            returnTo={`/seedlings/${id}`}
            signInHref={`/sign-in?next=${encodeURIComponent(`/seedlings/${id}`)}`}
            notice={query.seedNotice}
            failure={query.seedError}
          />
        </div>
      ) : null}

      {query.mergeNotice === "done" ? (
        <FormMessage tone="success">{t("assistive.merge.done")}</FormMessage>
      ) : null}
      <MessagingFeedback error={query.messagingError} notice={query.messagingNotice} />
      {publicPart ? (
        <div className="flex flex-wrap items-center gap-3">
          {viewer && !isHolder ? (
            <StartConversation
              kind="seedling"
              target={id}
              returnTo={`/seedlings/${id}`}
              label={t("messaging.start.seedling")}
              id="start-seedling"
            />
          ) : null}
          <AvailabilityControl
            seedlingId={id}
            returnTo={`/seedlings/${id}`}
            subscribed={subscribed}
            signedIn={viewer !== null}
            isHolder={isHolder}
            id="availability"
          />
        </div>
      ) : null}

      <RehomePanel
        seedlingId={id}
        holderId={seedling.currentHolderId}
        notice={query.rehome}
        failure={query.rehomeError}
      />

      <section aria-labelledby="history-title" className="flex flex-col gap-3">
        <h2 id="history-title" className="text-lg font-medium text-text">
          {t("seedlings.page.history")}
        </h2>
        <ul className="flex flex-col gap-2 text-base text-text">
          {provenance.map((event) =>
            event.eventType === "continuation_received" ? (
              <li key={event.occurredAt}>
                {t("rehome.provenance.continued", {
                  date: formatDate(event.occurredAt, locale),
                  name: transferNames.get(event.toHolderId ?? "") ?? t("rehome.provenance.someone"),
                })}
              </li>
            ) : (
              <li key={event.occurredAt}>
                {t("seedlings.page.onDate", {
                  event:
                    event.eventType === "originated"
                      ? t("seedlings.page.originated")
                      : t("seedlings.page.recorded"),
                  date: formatDate(event.occurredAt, locale),
                })}
                {event.eventType === "originated" && originator
                  ? ` ${t("seedlings.page.byName", { name: originator })}`
                  : ""}
              </li>
            ),
          )}
        </ul>
        <p className="text-sm text-text-muted">
          {t("seedlings.page.addedOn", { date: formatDate(seedling.createdAt, locale) })}
        </p>
      </section>

      {observations.length > 0 ? (
        <section aria-labelledby="observations-title" className="flex flex-col gap-4">
          <h2 id="observations-title" className="text-lg font-medium text-text">
            {t("seedlings.page.privateObservations")}
          </h2>
          <p className="text-sm text-text-muted">{t("seedlings.page.onlyYou")}</p>
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
                          src={photoSrc(first.id, first.mimeType)}
                          mime={first.mimeType}
                          label={t("seedlings.page.privatePhoto")}
                        />
                      </div>
                    ) : null}
                    <span className="text-base font-medium text-text-brand">
                      {t("seedlings.page.observed")} <LocalTime iso={item.observedAt} />
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
            {t("seedlings.page.manage")}
          </h2>
          <Link
            href={`/seedlings/${id}/merge`}
            className="inline-flex min-h-11 items-center self-start rounded-control border border-border bg-surface px-4 text-base text-text-brand"
          >
            {t("assistive.merge.open")}
          </Link>

          {!seedling.firstGrownYear && yearNeeded ? (
            <p className="rounded-surface border border-border bg-surface p-4 text-base text-text">
              {t("seedlings.page.yearNeeded")}
            </p>
          ) : null}

          {attachable.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4">
              <AttachSeriesForm
                seedlingId={id}
                series={attachable.map((item) => ({
                  id: item.id,
                  label: patternUsesYear(item.pattern)
                    ? t("seedlings.create.seriesWithYear", { name: item.name })
                    : t("seedlings.create.seriesPlain", { name: item.name }),
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
            heading={t("seedlings.page.seedParent")}
            defaults={parentDefaults("seed_parent")}
            unidentifiedChoices={unidentifiedChoices}
          />
          <ParentForm
            seedlingId={id}
            role="pollen_parent"
            heading={t("seedlings.page.pollenParent")}
            defaults={parentDefaults("pollen_parent")}
            unidentifiedChoices={unidentifiedChoices}
          />
        </section>
      ) : null}
    </article>
  );
}
