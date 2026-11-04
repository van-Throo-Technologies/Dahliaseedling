import Link from "next/link";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { formatDate, formatCount } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { avatarHref } from "@/modules/identity/presentation";
import type { UpdateSummary } from "@/modules/publications/repository";
import { PublicPhoto } from "./public-photo";
import { LikeForm } from "./social-buttons";
import { displayedName } from "@/modules/identity/former-grower";

/*
 * One Update in the Feed or on a seedling's journey. The photo leads, the grower's caption follows, and the
 * social actions sit underneath. The card carries no identifiers, parentage or traits: those live on the
 * seedling page. Tapping a photo opens the persistent seedling page.
 */

export async function UpdateCard({
  update,
  showSeedling = true,
}: {
  readonly update: UpdateSummary;
  readonly showSeedling?: boolean;
}) {
  const { t, locale } = await getTranslation();
  const [lead, ...others] = update.images;
  const seedlingHref = `/seedlings/${update.seedlingId}`;
  const seedlingLabel = update.seedlingName ?? t("publication.update.unnamedSeedling");
  const comments = update.commentCount;
  const commentText =
    comments === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(comments, locale) });

  return (
    <article
      aria-label={t("publication.update.byAuthor", {
        name: displayedName(update.authorName, t("privacy.formerGrower")),
      })}
      className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
    >
      <header className="flex items-center gap-3">
        <ProfileAvatar
          name={displayedName(update.authorName, t("privacy.formerGrower"))}
          url={update.authorHasAvatar ? avatarHref(update.authorId) : null}
        />
        <div className="flex min-w-0 flex-col">
          <Link href={`/profiles/${update.authorId}`} className="font-medium text-text-brand">
            {displayedName(update.authorName, t("privacy.formerGrower"))}
          </Link>
          <p className="text-sm text-text-muted">
            {t("publication.update.shared", { date: formatDate(update.publishedAt, locale) })}
            {showSeedling && update.seedlingName ? (
              <>
                {" · "}
                <Link href={seedlingHref} className="text-text-brand">
                  {update.seedlingName}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </header>

      {update.caption ? (
        <p className="whitespace-pre-line text-base text-text">{update.caption}</p>
      ) : null}

      {lead ? (
        <Link
          href={seedlingHref}
          aria-label={t("publication.update.openSeedling", { seedling: seedlingLabel })}
          className="block rounded-surface focus-visible:outline-2"
        >
          <PublicPhoto
            image={lead}
            alt={t("publication.update.photoAlt", {
              author: displayedName(update.authorName, t("privacy.formerGrower")),
              seedling: seedlingLabel,
            })}
          />
        </Link>
      ) : null}

      {others.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2" aria-label={t("publication.update.morePhotos")}>
          {others.map((image) => (
            <li key={image.id}>
              <Link
                href={seedlingHref}
                aria-label={t("publication.update.openSeedling", { seedling: seedlingLabel })}
                className="block"
              >
                <PublicPhoto
                  image={image}
                  alt={t("publication.update.anotherPhoto", { seedling: seedlingLabel })}
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="flex flex-wrap items-center gap-3">
        <LikeForm updateId={update.updateId} liked={update.likedByMe} count={update.likeCount} />
        <Link
          href={`/updates/${update.updateId}`}
          className="inline-flex min-h-11 items-center px-2 text-base text-text-brand"
        >
          {commentText}
        </Link>
      </footer>
    </article>
  );
}
