"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { useLocale, useT } from "@/i18n/client";
import { formatCount, formatDate } from "@/i18n/format";
import { CommentForm } from "./comment-form";
import { LikeForm } from "./social-buttons";

/*
 * The count line and action row of a Feed card. Comment opens a composer directly beneath the row, with its text box focused. A posted
 * comment appears beneath the row and the count goes up by one, with no navigation and no page refresh. The full discussion stays one
 * link away on the Update page. A visitor gets a sign-in link in place of the composer.
 *
 * The composer is the same CommentForm the Update page uses, so the same action, validation and permission checks apply.
 */

const actionClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand transition-colors hover:border-text-brand";

interface PostedComment {
  readonly body: string;
  readonly postedAt: string;
}

export function FeedActions({
  updateId,
  liked,
  likeCount,
  photoText,
  likeText,
  commentCount,
  signedIn,
}: {
  readonly updateId: string;
  readonly liked: boolean;
  readonly likeCount: number;
  /** The photo count, or null when the Update has one photograph. */
  readonly photoText: string | null;
  readonly likeText: string;
  readonly commentCount: number;
  readonly signedIn: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [posted, setPosted] = useState<readonly PostedComment[]>([]);
  const [justPosted, setJustPosted] = useState(false);
  // The count when the card first appeared, before anything was posted here. Posting refreshes the Feed, so the server count can
  // already include the new comment by the time the post is recorded; the larger of the two numbers is then the right one.
  const [baseCount] = useState(commentCount);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const total = Math.max(commentCount, baseCount + posted.length);
  const commentText =
    total === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(total, locale) });

  // Focus moves into the composer when it opens, so the text can be typed at once.
  useEffect(() => {
    if (open) panelRef.current?.querySelector("textarea")?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  const handlePosted = useCallback(({ body }: { readonly body: string }) => {
    setPosted((list) => [...list, { body, postedAt: new Date().toISOString() }]);
    setJustPosted(true);
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="flex flex-wrap gap-x-3 text-sm text-text-muted">
        {photoText ? <span>{photoText}</span> : null}
        <span>{likeText}</span>
        <span>{commentText}</span>
      </p>
      <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <LikeForm updateId={updateId} liked={liked} count={likeCount} showCount={false} />
        {signedIn ? (
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              setJustPosted(false);
              setOpen((isOpen) => !isOpen);
            }}
            className={actionClass}
          >
            {t("publication.update.comment")}
          </button>
        ) : (
          <Link
            href={`/sign-in?next=${encodeURIComponent(`/updates/${updateId}#comments`)}`}
            className={actionClass}
          >
            {t("publication.comments.signInToComment")}
          </Link>
        )}
      </footer>

      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        {open ? (
          <div className="flex flex-col gap-3">
            <CommentForm
              updateId={updateId}
              label={t("publication.comments.yourComment")}
              submitLabel={t("publication.comments.post")}
              onSaved={handlePosted}
            />
            <button type="button" onClick={close} className={`${actionClass} self-start`}>
              {t("publication.comments.cancel")}
            </button>
          </div>
        ) : null}
      </div>

      {justPosted ? (
        <FormMessage tone="success">{t("publication.comments.posted")}</FormMessage>
      ) : null}
      {posted.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {posted.map((comment, index) => (
            <li key={index}>
              <article
                aria-label={t("publication.comments.byAuthor", {
                  name: t("publication.comments.you"),
                })}
                className="flex flex-col gap-1"
              >
                <p className="text-sm text-text-muted">
                  <span className="font-medium text-text">{t("publication.comments.you")}</span>
                  {" · "}
                  <time dateTime={comment.postedAt}>{formatDate(comment.postedAt, locale)}</time>
                </p>
                <p className="whitespace-pre-line text-base text-text">{comment.body}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
      {total > 0 ? (
        <Link
          href={`/updates/${updateId}#comments`}
          className="inline-flex min-h-11 items-center text-base font-medium text-text-brand"
        >
          {t("publication.comments.viewAll")}
        </Link>
      ) : null}
    </div>
  );
}
