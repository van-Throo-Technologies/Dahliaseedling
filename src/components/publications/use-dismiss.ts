"use client";

import { useEffect, type RefObject } from "react";

/*
 * Calls onDismiss when a pointer goes down outside the element while it is open. Escape is handled by the menu itself, where focus is,
 * so the two together close a menu from either touch or keyboard.
 */
export function useDismissOnOutsideTap(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function dismissIfOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }
    document.addEventListener("pointerdown", dismissIfOutside);
    return () => document.removeEventListener("pointerdown", dismissIfOutside);
  }, [ref, open, onDismiss]);
}
