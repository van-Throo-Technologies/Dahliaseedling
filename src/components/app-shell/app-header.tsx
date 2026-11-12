import Link from "next/link";
import { InboxIcon } from "@/design-system/icons";
import { getTranslation } from "@/i18n/server";
import { APP_NAME } from "@/lib/brand";
import { LanguageSelector } from "./language-selector";

interface AppHeaderProps {
  readonly signedIn: boolean;
}

/**
 * Top bar shared by visitors and growers, so the product feels like one thing. The inbox icon is
 * always present; for visitors, following it leads to sign-in.
 */
export async function AppHeader({ signedIn }: AppHeaderProps) {
  const { t } = await getTranslation();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-14 max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 lg:max-w-none lg:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-display text-xl text-text-brand no-underline"
        >
          {APP_NAME}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSelector />
          {signedIn ? null : (
            <Link
              href="/sign-in"
              className="inline-flex min-h-11 items-center rounded-control px-3 text-base font-medium text-text-brand no-underline"
            >
              {t("app.header.signIn")}
            </Link>
          )}
          <Link
            href="/inbox"
            aria-label={t("app.nav.inbox")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-brand no-underline"
          >
            <InboxIcon className="h-6 w-6" />
          </Link>
        </div>
      </div>
    </header>
  );
}
