"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CommentIcon } from "@/design-system/icons";
import { useLocale, useT } from "@/i18n/client";
import { formatCount } from "@/i18n/format";
import { CommentForm } from "./comment-form";
import { ConversationDialog } from "./conversation-dialog";
import { ReplyContext, type ReplyTarget } from "./conversation-reply";
import { InitialsAvatar } from "./initials-avatar";
import { LikeForm } from "./social-buttons";

/*
 * The Feed card's counts and quiet action row. Comment opens the conversation in a dialog, with the post beside it and the discussion
 * and one composer beneath. Reply on a comment switches that same composer into reply mode; Cancel returns it to ordinary comments.
 * The discussion and the post context are rendered on the server and passed in, so nothing is fetched on click. A visitor gets a
 * sign-in link in place of Comment.
 *
 * A saved comment or reply arrives with the refreshed discussion. A saved reply opens its parent's replies and leaves reply mode; the
 * count is the server's, so it moves up by exactly one.
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
  const [replyTo, setReplyTo] = useState<ReplyTarget>(null);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const replyRef = useRef<ReplyTarget>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    replyRef.current = replyTo;
  }, [replyTo]);

  const commentText =
    commentCount === 1
      ? t("publication.update.comments.one")
      : t("publication.update.comments.other", { count: formatCount(commentCount, locale) });

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => composerRef.current?.querySelector("textarea")?.focus());
  }, []);

  const startReply = useCallback(
    (target: NonNullable<ReplyTarget>) => {
      setReplyTo(target);
      focusComposer();
    },
    [focusComposer],
  );

  const cancelReply = useCallback(() => {
    setReplyTo(null);
    focusComposer();
  }, [focusComposer]);

  const releaseExpanded = useCallback((parentId: string) => {
    setExpandedParentId((current) => (current === parentId ? null : current));
  }, []);

  // A saved comment or reply: a reply opens its parent and leaves reply mode; a comment scrolls to the newest message.
  const handleSaved = useCallback(() => {
    const parent = replyRef.current;
    if (parent) {
      setExpandedParentId(parent.id);
      setReplyTo(null);
      return;
    }
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    });
  }, []);

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
        <ReplyContext.Provider value={{ expandedParentId, startReply, releaseExpanded }}>
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
              <div className="flex flex-col gap-1.5">
                {replyTo ? (
                  <div className="flex items-center justify-between gap-3 text-[13px] text-text-muted">
                    <span>{t("publication.comments.replyingTo", { name: replyTo.name })}</span>
                    <button
                      type="button"
                      onClick={cancelReply}
                      className="inline-flex min-h-9 items-center font-semibold text-text-brand hover:underline"
                    >
                      {t("publication.comments.cancel")}
                    </button>
                  </div>
                ) : null}
                <div className="flex items-end gap-2.5">
                  <InitialsAvatar name={viewerName || "?"} tone="you" />
                  <div className="min-w-0 flex-1">
                    <CommentForm
                      key={replyTo ? `reply-${replyTo.id}` : "comment"}
                      updateId={updateId}
                      parentId={replyTo?.id}
                      label={
                        replyTo
                          ? t("publication.comments.replyTo", { name: replyTo.name })
                          : t("publication.comments.yourComment")
                      }
                      submitLabel={t("publication.comments.send")}
                      submitOnEnter
                      pill
                      placeholder={
                        replyTo
                          ? t("publication.comments.replyTo", { name: replyTo.name })
                          : viewerName
                            ? t("publication.comments.commentAs", { name: viewerName })
                            : t("publication.comments.placeholder")
                      }
                      onSaved={handleSaved}
                    />
                  </div>
                </div>
              </div>
            }
          />
        </ReplyContext.Provider>
      ) : null}
    </>
  );
}
