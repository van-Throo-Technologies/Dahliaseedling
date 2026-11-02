import Link from "next/link";
import { ProfileAvatar } from "@/components/identity/profile-avatar";
import { avatarHref } from "@/modules/identity/presentation";
import type { UpdateSummary } from "@/modules/publications/repository";
import { formatDate } from "@/modules/seedlings/presentation";
import { PublicPhoto } from "./public-photo";
import { LikeForm } from "./social-buttons";

/*
 * One Update in the Feed or on a seedling's journey. The photo leads, the grower's caption follows, and the
 * social actions sit underneath. The card carries no identifiers, parentage or traits: those live on the
 * seedling page. Tapping a photo opens the persistent seedling page.
 */

export function UpdateCard({
  update,
  showSeedling = true,
}: {
  readonly update: UpdateSummary;
  readonly showSeedling?: boolean;
}) {
  const [lead, ...others] = update.images;
  const seedlingHref = `/seedlings/${update.seedlingId}`;
  const seedlingLabel = update.seedlingName ?? "a seedling";
  const comments = update.commentCount;

  return (
    <article
      aria-label={`Update by ${update.authorName}`}
      className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
    >
      <header className="flex items-center gap-3">
        <ProfileAvatar
          name={update.authorName}
          url={update.authorHasAvatar ? avatarHref(update.authorId) : null}
        />
        <div className="flex min-w-0 flex-col">
          <Link href={`/profiles/${update.authorId}`} className="font-medium text-text-brand">
            {update.authorName}
          </Link>
          <p className="text-sm text-text-muted">
            Shared {formatDate(update.publishedAt)}
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
          aria-label={`Open ${seedlingLabel}`}
          className="block rounded-surface focus-visible:outline-2"
        >
          <PublicPhoto
            image={lead}
            alt={`Photo shared by ${update.authorName} of ${seedlingLabel}`}
          />
        </Link>
      ) : null}

      {others.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2" aria-label="More photos in this update">
          {others.map((image) => (
            <li key={image.id}>
              <Link href={seedlingHref} aria-label={`Open ${seedlingLabel}`} className="block">
                <PublicPhoto image={image} alt={`Another photo from ${seedlingLabel}`} />
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
          {comments === 1 ? "1 comment" : `${comments} comments`}
        </Link>
      </footer>
    </article>
  );
}
