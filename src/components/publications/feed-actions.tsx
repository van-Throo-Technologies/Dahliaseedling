"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { CommentIcon } from "@/design-system/icons";
import { useLocale, useT } from "@/i18n/client";
import { formatCount } from "@/i18n/format";
import { CommentForm } from "./comment-form";
import { ConversationDialog } from "./conversation-dialog";
import { InitialsAvatar } from "./initials-avatar";
import { LikeForm } from "./social-buttons";

/*
 * The Feed card's counts and quiet action row. Comment opens the conversation in a dialog, with the post beside it and the discussion
 * and composer beneath. The discussion and the post context are rendered on the server and passed in, so nothing is fetched on click.
 * A visitor gets a sign-in link in place of Comment.
 *
 * When a comment is posted, the composer clears and the conversation stays open. The new comment arrives with the refreshed discussion,
 * and the discussion scrolls to it. The count is the server's count, so it moves up by exactly one.
 */

const quietAction =
  "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium text-text-muted transition-colors hover:bg-background hover:text-text-brand";

export function FeedActions({
  updateId,
  liked,
  likeCount,
  photoText,
  likeText,
  commentCount,
  signedIn,
  viewerName,
  context,
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
  /** The viewer's display name, shown in the composer's placeholder. Empty when the viewer has none. */
  readonly viewerName: string;
  /** The post beside the conversation: the photograph, the grower, the caption and the Seedling. */
  readonly context: ReactNode;
  /** The discussion, rendered on the server. */
  readonly discussion: ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const commentText =
    commentCount === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(commentCount, locale) });

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // The new comment comes with the refreshed discussion. Scroll once it has been painted, so it is in view.
  const handleSaved = useCallback(() => {
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const placeholder = viewerName
    ? t("publication.comments.commentAs", { name: viewerName })
    : t("publication.comments.placeholder");

  return (
    <>
      <div className="flex flex-col gap-2 p-4">
        <p className="flex flex-wrap gap-x-3 text-[13px] text-text-muted">
          {photoText ? <span>{photoText}</span> : null}
          <span>{likeText}</span>
          <span>{commentText}</span>
        </p>
        <footer className="-mx-1 flex items-center gap-1 border-t border-border pt-2">
          <LikeForm updateId={updateId} liked={liked} count={likeCount} showCount={false} quiet />
          {signedIn ? (
            <button
              ref={toggleRef}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              className={quietAction}
            >
              <CommentIcon className="size-[18px]" />
              {t("publication.update.comment")}
            </button>
          ) : (
            <Link
              href={`/sign-in?next=${encodeURIComponent(`/updates/${updateId}#comments`)}`}
              className={quietAction}
            >
              <CommentIcon className="size-[18px]" />
              {t("publication.comments.signInToComment")}
            </Link>
          )}
        </footer>
      </div>

      {signedIn ? (
        <ConversationDialog
          open={open}
          onClose={close}
          title={
            <>
              {t("publication.comments.conversation")}
              <span className="font-sans text-sm font-normal text-text-muted">
                {" "}
                · {commentText}
              </span>
            </>
          }
          context={context}
          discussion={discussion}
          scrollRef={scrollRef}
          composerRef={composerRef}
          composer={
            <div className="flex items-end gap-2.5">
              <InitialsAvatar name={viewerName || "?"} tone="you" />
              <div className="min-w-0 flex-1">
                <CommentForm
                  updateId={updateId}
                  label={t("publication.comments.yourComment")}
                  submitLabel={t("publication.comments.send")}
                  submitOnEnter
                  pill
                  placeholder={placeholder}
                  onSaved={handleSaved}
                />
              </div>
            </div>
          }
        />
      ) : null}
    </>
  );
}
