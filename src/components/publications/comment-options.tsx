"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MoreIcon } from "@/design-system/icons";
import { useT } from "@/i18n/client";
import { deleteCommentAction } from "@/modules/publications/actions";
import { CommentEditForm } from "./comment-form";
import { useDismissOnOutsideTap } from "./use-dismiss";

/*
 * A comment's three-dot menu, beside its byline. For the author it holds Edit and Delete. For other readers it holds only the report
 * action, when the reader may report. The server renders each item only when it is permitted, and the database checks ownership and
 * moderation rules again on every change. Editing replaces the text with the edit form in place; saving or Cancel shows the text again.
 */
export function CommentOptions({
  updateId,
  commentId,
  body,
  byline,
  bodyClassName = "whitespace-pre-line text-base text-text",
  canEdit = true,
  report,
}: {
  readonly updateId: string;
  readonly commentId: string;
  readonly body: string;
  readonly byline: ReactNode;
  /** How the comment's text is styled. The conversation dialog draws it in a bubble. */
  readonly bodyClassName?: string;
  /** Only the author may edit or delete. */
  readonly canEdit?: boolean;
  /** The report action, when the reader may report this comment. It is shown inside the menu, not beside the comment. */
  readonly report?: ReactNode;
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
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-0.5">
        <div className="min-w-0">{byline}</div>
        {canEdit || report ? (
          <div ref={rootRef} className="relative shrink-0" onKeyDown={closeOnEscape}>
            <button
              ref={triggerRef}
              type="button"
              aria-label={t("publication.comments.options")}
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((value) => !value)}
              className="-my-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-muted"
            >
              <MoreIcon className="h-6 w-6" />
            </button>
            <div
              id={menuId}
              hidden={!open}
              className="absolute right-0 top-full z-10 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-control border border-border bg-surface p-1"
            >
              {canEdit ? (
                <>
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
                </>
              ) : null}
              {report ? (
                <div className={canEdit ? "mt-1 border-t border-border p-2" : "p-2"}>{report}</div>
              ) : null}
            </div>
          </div>
        ) : null}
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
