import Link from "next/link";
import type { ReactNode } from "react";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { formatDate, formatCount } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { avatarHref } from "@/modules/identity/presentation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FEED_COMMENT_LIMIT } from "@/modules/publications/limits";
import {
  listComments,
  type PublicImage,
  type UpdateSummary,
} from "@/modules/publications/repository";
import { PublicPhoto } from "./public-photo";
import { CommentThread } from "./comment-thread";
import { FeedActions } from "./feed-actions";
import { LikeForm } from "./social-buttons";
import { displayedName } from "@/modules/identity/former-grower";

/*
 * One Update in the Feed or on a seedling's journey. The order is the grower and the date, then the text, then a labelled link to the
 * Seedling when the Update has one, then the photographs, then the counts, then the actions.
 *
 * An Update does not have to belong to a Seedling in order to be shown. An ordinary Update has no Seedling line; a Seedling-linked Update
 * shows it. The card carries no identifiers, parentage or traits: those live on the Seedling page.
 *
 * A photograph is never cropped: tapping it opens the full picture in a new tab.
 */

/** A photograph that opens at full size. The link is the photograph itself, so no extra control is needed to reach it. */
function FullSizePhoto({
  image,
  alt,
  label,
  square = false,
  flush = false,
}: {
  readonly image: PublicImage;
  readonly alt: string;
  readonly label: string;
  readonly square?: boolean;
  readonly flush?: boolean;
}) {
  return (
    <a
      href={image.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="block rounded-control focus-visible:outline-2"
    >
      <PublicPhoto image={image} alt={alt} square={square} flush={flush} />
    </a>
  );
}

/** The most recent comments on a Feed card. Rendered on the server with the card, so they show as soon as Comment is pressed. */
async function FeedDiscussion({
  updateId,
  signedIn,
}: {
  readonly updateId: string;
  readonly signedIn: boolean;
}) {
  const comments = await listComments(await createSupabaseServerClient(), updateId);
  return (
    <CommentThread
      updateId={updateId}
      comments={comments}
      canPost={signedIn}
      canReport={signedIn}
      limit={FEED_COMMENT_LIMIT}
      composer={false}
      sectionId={`feed-comments-${updateId}`}
    />
  );
}

export async function UpdateCard({
  update,
  showSeedling = true,
  menu,
  inlineComments,
}: {
  readonly update: UpdateSummary;
  readonly showSeedling?: boolean;
  /** The author's own controls, shown beside the header. Other viewers get no menu. */
  readonly menu?: ReactNode;
  /** The Feed opens the composer on the card. Other places keep the link to the Update page. */
  readonly inlineComments?: { readonly signedIn: boolean };
}) {
  const { t, locale } = await getTranslation();
  const [lead, ...others] = update.images;
  const seedlingHref = `/seedlings/${update.seedlingId}`;
  const seedlingLabel = update.seedlingName ?? t("publication.update.unnamedSeedling");
  const authorName = displayedName(update.authorName, t("privacy.formerGrower"));
  const photos = update.images.length;
  const likes = update.likeCount;
  const comments = update.commentCount;
  const likeText =
    likes === 1
      ? t("publication.update.likes.one")
      : t("publication.update.likes.other", { count: formatCount(likes, locale) });
  const commentText =
    comments === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(comments, locale) });
  const photoText =
    photos === 1
      ? t("publication.update.photos.one")
      : t("publication.update.photos.other", { count: formatCount(photos, locale) });

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
          <div className="flex min-w-0 flex-1 flex-col">
            <Link
              href={`/profiles/${update.authorId}`}
              className="inline-flex min-h-11 items-center font-medium text-text-brand"
            >
              {authorName}
            </Link>
            <time dateTime={update.publishedAt} className="text-sm text-text-muted">
              {t("publication.update.shared", { date: formatDate(update.publishedAt, locale) })}
            </time>
          </div>
          {menu}
        </header>

        {update.caption ? (
          <p className="whitespace-pre-line text-base text-text">{update.caption}</p>
        ) : null}

        {showSeedling ? (
          <Link
            href={seedlingHref}
            className="inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-control border border-border bg-background px-3 text-sm text-text no-underline"
          >
            <span className="text-text-muted">{t("publication.update.seedlingLabel")}</span>
            <span className="min-w-0 truncate font-medium text-text-brand">{seedlingLabel}</span>
          </Link>
        ) : null}
      </div>

      {lead ? (
        <FullSizePhoto
          image={lead}
          alt={t("publication.update.photoAlt", { author: authorName, seedling: seedlingLabel })}
          label={t("publication.update.openFullSize")}
          flush
        />
      ) : null}

      {others.length > 0 ? (
        <ul
          className="grid grid-cols-3 gap-2 px-4 pt-3"
          aria-label={t("publication.update.morePhotos")}
        >
          {others.map((image) => (
            <li key={image.id}>
              <FullSizePhoto
                image={image}
                alt={t("publication.update.anotherPhoto", { seedling: seedlingLabel })}
                label={t("publication.update.openFullSize")}
                square
              />
            </li>
          ))}
        </ul>
      ) : null}

      {inlineComments ? (
        <FeedActions
          updateId={update.updateId}
          liked={update.likedByMe}
          likeCount={likes}
          photoText={photos > 1 ? photoText : null}
          likeText={likeText}
          commentCount={comments}
          signedIn={inlineComments.signedIn}
          discussion={
            <FeedDiscussion updateId={update.updateId} signedIn={inlineComments.signedIn} />
          }
        />
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <p className="flex flex-wrap gap-x-3 text-sm text-text-muted">
            {photos > 1 ? <span>{photoText}</span> : null}
            <span>{likeText}</span>
            <span>{commentText}</span>
          </p>
          <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <LikeForm
              updateId={update.updateId}
              liked={update.likedByMe}
              count={update.likeCount}
              showCount={false}
            />
            <Link
              href={`/updates/${update.updateId}#comments`}
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand transition-colors hover:border-text-brand"
            >
              {t("publication.update.comment")}
            </Link>
          </footer>
        </div>
      )}
    </article>
  );
}
