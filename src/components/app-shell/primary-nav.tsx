"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { BellIcon, HomeIcon, SearchIcon, UserIcon } from "@/design-system/icons";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  readonly href: string;
  readonly labelKey: MessageKey;
  readonly icon: NavIcon;
}

/**
 * The primary destinations, in order: Home, Notifications, Profile. Posting is not a destination: it happens in the composer at the top of
 * the Feed, so there is no separate Capture tab.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", labelKey: "app.nav.home", icon: HomeIcon },
  { href: "/explore", labelKey: "app.nav.explore", icon: SearchIcon },
  { href: "/notifications", labelKey: "app.nav.notifications", icon: BellIcon },
  { href: "/profile", labelKey: "app.nav.profile", icon: UserIcon },
];

/*
 * Whether a destination is the current page. Profile is the grower's own profile and its management pages, but not the onboarding
 * step that a grower without a profile is sent through, so Profile is not shown as current while the grower is setting it up.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/profile") {
    if (pathname === "/profile/setup" || pathname.startsWith("/profile/setup/")) return false;
    return pathname === "/profile" || pathname.startsWith("/profile/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Phone-first primary navigation: fixed to the bottom, with safe-area padding. From the medium breakpoint up it becomes a static row
 * under the header, with the same items in the same order. The current destination has three cues that do not rely on colour: a bar
 * above its icon, bold text, and aria-current for assistive technology.
 */
export function PrimaryNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label={t("app.nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[max(env(safe-area-inset-bottom),0.5rem)] md:static md:border-t-0 md:border-b md:pb-0 lg:sticky lg:top-6 lg:inset-auto lg:w-56 lg:shrink-0 lg:self-start lg:border-0 lg:bg-transparent lg:pb-0"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4 items-end px-2 md:flex md:justify-center md:gap-2 md:px-4 lg:max-w-none lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:px-0">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex justify-center lg:justify-stretch">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-control px-2 py-2 text-sm no-underline lg:min-h-11 lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:hover:bg-surface ${
                  active ? "font-bold text-text-brand" : "font-medium text-text-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1 w-6 rounded-full lg:h-6 lg:w-1 ${active ? "bg-primary" : "invisible"}`}
                />
                <Icon className="h-6 w-6" />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
