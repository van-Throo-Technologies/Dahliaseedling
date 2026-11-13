"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MoreIcon } from "@/design-system/icons";
import { useT } from "@/i18n/client";
import { deleteCommentAction } from "@/modules/publications/actions";
import { CommentEditForm } from "./comment-form";
import { useDismissOnOutsideTap } from "./use-dismiss";

/*
 * The comment author's own controls: a three-dot menu with Edit and Delete, beside the byline. The server renders this only for the
 * author, and the database checks ownership again on every change. Editing replaces the text with the edit form in place; saving or
 * Cancel shows the text again.
 */
export function CommentOptions({
  updateId,
  commentId,
  body,
  byline,
  bodyClassName = "whitespace-pre-line text-base text-text",
}: {
  readonly updateId: string;
  readonly commentId: string;
  readonly body: string;
  readonly byline: ReactNode;
  /** How the comment's text is styled. The conversation dialog draws it in a bubble. */
  readonly bodyClassName?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const closeMenu = useCallback(() => setOpen(false), []);
  useDismissOnOutsideTap(rootRef, open, closeMenu);

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    // With the menu open, Escape closes only the menu, not the conversation around it.
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
  }

  function startEditing() {
    setOpen(false);
    setEditing(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{byline}</div>
        <div ref={rootRef} className="relative shrink-0" onKeyDown={closeOnEscape}>
          <button
            ref={triggerRef}
            type="button"
            aria-label={t("publication.comments.options")}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-muted"
          >
            <MoreIcon className="h-6 w-6" />
          </button>
          <div
            id={menuId}
            hidden={!open}
            className="absolute right-0 top-full z-10 mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-control border border-border bg-surface p-1"
          >
            <button
              type="button"
              onClick={startEditing}
              className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-base font-medium text-text-brand"
            >
              {t("publication.comments.editComment")}
            </button>
            <form action={deleteCommentAction}>
              <input type="hidden" name="updateId" value={updateId} />
              <input type="hidden" name="commentId" value={commentId} />
              <button
                type="submit"
                className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-base font-medium text-destructive"
              >
                {t("publication.comments.deleteComment")}
              </button>
            </form>
          </div>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <CommentEditForm
            updateId={updateId}
            commentId={commentId}
            body={body}
            onSaved={() => setEditing(false)}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex min-h-11 w-fit items-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <p className={bodyClassName}>{body}</p>
      )}
    </div>
  );
}
