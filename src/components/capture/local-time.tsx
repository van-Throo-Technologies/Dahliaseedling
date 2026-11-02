"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * Shows an instant in the reader's own time zone. The server and the first render use UTC, so the markup
 * matches; the client then switches to local time without a hydration mismatch.
 */
export function LocalTime({ iso }: { readonly iso: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () =>
      new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short" }).format(
        new Date(iso),
      ),
    () =>
      `${new Intl.DateTimeFormat("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso))} UTC`,
  );
  return <time dateTime={iso}>{text}</time>;
}
