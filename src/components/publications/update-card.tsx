import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { formatDate, formatCount } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { avatarHref } from "@/modules/identity/presentation";
import type { UpdateSummary } from "@/modules/publications/repository";
import { PublicPhoto } from "./public-photo";
import { LikeForm } from "./social-buttons";
import { displayedName } from "@/modules/identity/former-grower";

/*
 * One Update in the Feed or on a seedling's journey, in a social-feed order: the grower's identity first, then the caption, then the
 * photographs, then the engagement row. The card carries no identifiers, parentage or traits: those live on the seedling page. Tapping
 * a photo opens the persistent seedling page. The comment count opens the discussion on the Update's own page.
 */

export async function UpdateCard({
  update,
  showSeedling = true,
  menu,
}: {
  readonly update: UpdateSummary;
  readonly showSeedling?: boolean;
  /** The author's own controls, shown beside the header. Other viewers get no menu. */
  readonly menu?: ReactNode;
}) {
  const { t, locale } = await getTranslation();
  const [lead, ...others] = update.images;
  const seedlingHref = `/seedlings/${update.seedlingId}`;
  const seedlingLabel = update.seedlingName ?? t("publication.update.unnamedSeedling");
  const authorName = displayedName(update.authorName, t("privacy.formerGrower"));
  const comments = update.commentCount;
  const commentText =
    comments === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(comments, locale) });

  return (
    <article
      aria-label={t("publication.update.byAuthor", { name: authorName })}
      className="flex flex-col overflow-hidden rounded-surface border border-border bg-surface"
    >
      <div className="flex flex-col gap-3 p-4">
        <header className="flex items-center gap-3">
          <ProfileAvatar
            name={authorName}
            url={update.authorHasAvatar ? avatarHref(update.authorId) : null}
          />
          <div className="flex min-w-0 flex-col">
            <Link href={`/profiles/${update.authorId}`} className="font-medium text-text-brand">
              {authorName}
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
          {menu}
        </header>

        {update.caption ? (
          <p className="whitespace-pre-line text-base text-text">{update.caption}</p>
        ) : null}
      </div>

      {lead ? (
        <Link
          href={seedlingHref}
          aria-label={t("publication.update.openSeedling", { seedling: seedlingLabel })}
          className="block focus-visible:outline-2"
        >
          <PublicPhoto
            image={lead}
            alt={t("publication.update.photoAlt", {
              author: authorName,
              seedling: seedlingLabel,
            })}
            flush
          />
        </Link>
      ) : null}

      {others.length > 0 ? (
        <ul
          className="grid grid-cols-3 gap-2 px-4 pt-3"
          aria-label={t("publication.update.morePhotos")}
        >
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

      <footer className="flex flex-wrap items-center gap-3 p-4">
        <LikeForm updateId={update.updateId} liked={update.likedByMe} count={update.likeCount} />
        <Link
          href={`/updates/${update.updateId}#comments`}
          className="inline-flex min-h-11 items-center px-2 text-base text-text-brand"
        >
          {commentText}
        </Link>
      </footer>
    </article>
  );
}
