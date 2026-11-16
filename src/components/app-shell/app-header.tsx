import Image from "next/image";
import Link from "next/link";
import { InboxIcon } from "@/design-system/icons";
import { getTranslation } from "@/i18n/server";
import { APP_NAME } from "@/lib/brand";
import { HeaderMenu } from "./header-menu";
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
      <div className="mx-auto flex min-h-16 max-w-2xl flex-nowrap items-center justify-between gap-x-2 px-4 py-1 sm:min-h-14 sm:flex-wrap sm:gap-x-4 sm:gap-y-1 lg:max-w-none lg:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            aria-label={APP_NAME}
            className="inline-flex min-h-11 items-center no-underline"
          >
            <Image
              src="/brand/dahliaseedling-logo-compact.svg"
              alt=""
              width={754}
              height={150}
              unoptimized
              priority
              className="h-9 w-auto sm:h-10 min-[1200px]:h-[54px]"
            />
          </Link>
          <p
            aria-hidden="true"
            className="hidden text-sm tracking-wide text-text-muted min-[1200px]:block"
          >
            {t("app.brand.tagline")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSelector />
          </div>
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
            className={`min-h-11 min-w-11 items-center justify-center rounded-control text-text-brand no-underline ${signedIn ? "inline-flex" : "hidden sm:inline-flex"}`}
          >
            <InboxIcon className="h-6 w-6" />
          </Link>
          <HeaderMenu showInbox={!signedIn} />
        </div>
      </div>
    </header>
  );
}
