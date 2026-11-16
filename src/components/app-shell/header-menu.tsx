"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { InboxIcon, MoreIcon } from "@/design-system/icons";
import { useT } from "@/i18n/client";
import { useDismissOnOutsideTap } from "@/components/publications/use-dismiss";
import { LanguageSelector } from "./language-selector";

/*
 * The phone header's overflow menu. It holds the language choice, and for a visitor the inbox, which otherwise sits in the bar. It
 * is shown only below the small breakpoint; wider screens show those controls in the bar. Escape closes it and returns focus to the
 * button; a tap outside closes it too. Each destination is the same link the bar uses.
 */
export function HeaderMenu({ showInbox }: { readonly showInbox: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const closeMenu = useCallback(() => setOpen(false), []);
  useDismissOnOutsideTap(rootRef, open, closeMenu);

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative sm:hidden" onKeyDown={closeOnEscape}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("app.header.menu")}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-brand"
      >
        <MoreIcon className="h-6 w-6" />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="absolute right-0 top-full z-40 mt-1 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-control border border-border bg-surface p-3"
      >
        <LanguageSelector id="language-select-menu" />
        {showInbox ? (
          <Link
            href="/inbox"
            onClick={closeMenu}
            className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-base font-medium text-text-brand no-underline"
          >
            <InboxIcon className="h-6 w-6" />
            {t("app.nav.inbox")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
