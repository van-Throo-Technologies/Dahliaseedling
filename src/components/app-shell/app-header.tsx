import Link from "next/link";
import { InboxIcon } from "@/design-system/icons";
import { strings } from "@/content/strings";

interface AppHeaderProps {
  readonly signedIn: boolean;
}

/**
 * Top bar shared by visitors and growers, so the product feels like one thing. The inbox icon is
 * always present; for visitors, following it leads to sign-in.
 */
export function AppHeader({ signedIn }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-14 max-w-2xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-display text-xl text-text-brand no-underline">
          {strings.appName}
        </Link>
        <div className="flex items-center gap-2">
          {signedIn ? null : (
            <Link
              href="/sign-in"
              className="inline-flex min-h-11 items-center rounded-control px-3 text-base font-medium text-text-brand no-underline"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/inbox"
            aria-label="Inbox"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-text-brand no-underline"
          >
            <InboxIcon className="h-6 w-6" />
          </Link>
        </div>
      </div>
    </header>
  );
}
