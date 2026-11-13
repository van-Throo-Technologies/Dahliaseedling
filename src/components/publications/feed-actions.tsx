"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocale, useT } from "@/i18n/client";
import { formatCount } from "@/i18n/format";
import { CommentForm } from "./comment-form";
import { LikeForm } from "./social-buttons";

/*
 * The count line and action row of a Feed card. Comment opens the discussion directly beneath the row, with the composer below it and
 * its text box focused. The conversation stays open after a post, and the new comment appears in it. The count is the server's count,
 * which the Feed refreshes after a post, so it moves up by exactly one. Success is announced to screen readers only. A visitor gets a
 * sign-in link in place of the conversation.
 *
 * The discussion and the composer are the same components the Update page uses, so the same action, validation and permission checks
 * apply. The discussion is rendered on the server and passed in, so nothing is fetched on click.
 */

const actionClass =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand transition-colors hover:border-text-brand";

export function FeedActions({
  updateId,
  liked,
  likeCount,
  photoText,
  likeText,
  commentCount,
  signedIn,
  discussion,
}: {
  readonly updateId: string;
  readonly liked: boolean;
  readonly likeCount: number;
  /** The photo count, or null when the Update has one photograph. */
  readonly photoText: string | null;
  readonly likeText: string;
  readonly commentCount: number;
  readonly signedIn: boolean;
  /** The most recent comments on this Update, rendered on the server. */
  readonly discussion: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const commentText =
    commentCount === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(commentCount, locale) });

  // Focus moves into the composer when the discussion opens, so the text can be typed at once. The composer's own box is used:
  // the discussion's reply boxes come first in the page, and they sit inside closed disclosures that cannot take focus.
  useEffect(() => {
    if (open) composerRef.current?.querySelector("textarea")?.focus();
  }, [open]);

  const close = useCallback(() => {
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
            onClick={() => setOpen((isOpen) => !isOpen)}
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
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        {open ? (
          <div className="flex flex-col gap-4">
            {discussion}
            <div ref={composerRef}>
              <CommentForm
                updateId={updateId}
                label={t("publication.comments.yourComment")}
                submitLabel={t("publication.comments.send")}
                submitOnEnter
              />
            </div>
          </div>
        ) : null}
      </div>

      {commentCount > 0 ? (
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
