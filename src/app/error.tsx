"use client";

import { useT } from "@/i18n/client";

/**
 * The fallback for an unexpected error below the root layout. It shows a calm, translated message and a retry, and
 * never the raw error text, which may contain internal detail.
 */
export default function ErrorPage({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const t = useT();
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <h1 id="page-title" className="font-display text-3xl text-text-brand">
        {t("errors.unexpected")}
      </h1>
      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
      >
        {t("common.retry")}
      </button>
    </section>
  );
}
