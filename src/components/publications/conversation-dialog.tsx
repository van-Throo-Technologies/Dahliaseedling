"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { useT } from "@/i18n/client";

/*
 * The conversation on a Feed card, as a modal dialog. The browser traps focus inside it, closes it on Escape, and makes the page behind
 * inert. The composer takes focus when the dialog opens, and focus returns to the Comment control when it closes.
 *
 * On a wide screen the dialog sits in the middle: the post on the left, the discussion on the right. On a phone it fills the screen: the
 * post is a strip at the top, the discussion scrolls beneath it, and the composer stays at the foot above the keyboard.
 */
export function ConversationDialog({
  open,
  title,
  onClose,
  context,
  discussion,
  composer,
  scrollRef,
  composerRef,
}: {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly onClose: () => void;
  readonly context: ReactNode;
  readonly discussion: ReactNode;
  readonly composer: ReactNode;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly composerRef: RefObject<HTMLDivElement | null>;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      composerRef.current?.querySelector("textarea")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, composerRef]);

  // The page behind does not scroll while the conversation is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-surface p-0 text-text backdrop:bg-[rgb(56_39_51/0.42)] open:flex min-[900px]:m-auto min-[900px]:h-[min(820px,calc(100dvh-48px))] min-[900px]:w-[min(980px,calc(100vw-48px))] min-[900px]:rounded-[14px]"
    >
      <div className="flex min-h-0 flex-1 flex-col min-[900px]:flex-row">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background p-3 min-[900px]:w-[42%] min-[900px]:flex-col min-[900px]:items-stretch min-[900px]:gap-0 min-[900px]:overflow-y-auto min-[900px]:border-r min-[900px]:border-b-0 min-[900px]:p-0">
          {context}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2 min-[900px]:px-[18px] min-[900px]:py-3">
            <h2 id={titleId} className="font-display text-[17px] font-semibold text-text-brand">
              {title}
            </h2>
            <button
              type="button"
              aria-label={t("publication.comments.closeConversation")}
              onClick={() => dialogRef.current?.close()}
              className="grid size-11 place-items-center rounded-control text-2xl leading-none text-text-brand hover:bg-background"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 min-[900px]:px-5"
          >
            {discussion}
          </div>

          <div
            ref={composerRef}
            className="shrink-0 border-t border-border bg-surface px-4 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] min-[900px]:px-[18px] min-[900px]:pt-3 min-[900px]:pb-3.5"
          >
            {composer}
          </div>
        </div>
      </div>
    </dialog>
  );
}
