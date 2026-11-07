"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MoreIcon } from "@/design-system/icons";
import { useT } from "@/i18n/client";
import { deleteUpdateAction } from "@/modules/publications/actions";

/*
 * The author's controls for one Update, behind a three-dot button beside the header. Removing is a second step: the explanation of
 * what removal does appears in a dialog, which Escape or "Keep" dismisses without changing anything. The removal itself is the same
 * deleteUpdateAction as before, and it still checks the signed-in author. This menu is rendered only for that author.
 */
export function UpdateMenu({ updateId }: { readonly updateId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuId = useId();
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideTap(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideTap);
    return () => document.removeEventListener("pointerdown", closeOnOutsideTap);
  }, [open]);

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  function openConfirmation() {
    setOpen(false);
    dialogRef.current?.showModal();
  }

  return (
    <div ref={rootRef} className="relative ml-auto" onKeyDown={closeOnEscape}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("publication.update.manage")}
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
        className="absolute right-0 top-full z-10 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-control border border-border bg-surface p-1"
      >
        <button
          type="button"
          onClick={openConfirmation}
          className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-base font-medium text-destructive"
        >
          {t("publication.update.remove")}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={textId}
        onClose={() => triggerRef.current?.focus()}
        className="m-auto w-[min(92vw,28rem)] rounded-surface border border-border bg-surface p-6 text-text backdrop:bg-black/40"
      >
        <h2 id={titleId} className="text-lg font-medium text-text">
          {t("publication.update.remove")}
        </h2>
        <p id={textId} className="mt-3 text-base text-text-muted">
          {t("publication.update.manageText")}
        </p>
        <form action={deleteUpdateAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="updateId" value={updateId} />
          <button
            type="submit"
            className="min-h-11 rounded-control bg-destructive px-4 text-base font-medium text-on-destructive"
          >
            {t("publication.update.remove")}
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
          >
            {t("publication.update.keep")}
          </button>
        </form>
      </dialog>
    </div>
  );
}
