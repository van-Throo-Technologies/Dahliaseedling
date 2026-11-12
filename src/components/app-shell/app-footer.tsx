"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

/**
 * Entry points to the information and settings every grower may need. Feedback records the path of the page it was opened from, without
 * its query string, because the pathname excludes the query.
 */
export function AppFooter() {
  const t = useT();
  const pathname = usePathname();
  const feedbackHref = `/feedback?from=${encodeURIComponent(pathname)}`;

  return (
    <footer className="mx-auto w-full max-w-2xl border-t border-border px-4 pb-28 pt-6 md:pb-10">
      <nav aria-label={t("launch.footer.label")}>
        <ul className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <li>
            <Link
              href="/legal/privacy"
              className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
            >
              {t("launch.footer.privacyInfo")}
            </Link>
          </li>
          <li>
            <Link
              href="/legal/terms"
              className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
            >
              {t("launch.footer.terms")}
            </Link>
          </li>
          <li>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
            >
              {t("launch.footer.accountPrivacy")}
            </Link>
          </li>
          <li>
            <Link
              href={feedbackHref}
              className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
            >
              {t("launch.footer.feedback")}
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
