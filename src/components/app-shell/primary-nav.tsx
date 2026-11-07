"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { BellIcon, CaptureIcon, HomeIcon, UserIcon } from "@/design-system/icons";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translator";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  readonly href: string;
  readonly labelKey: MessageKey;
  readonly icon: NavIcon;
  readonly dominant?: boolean;
}

/** The locked order: Home · Capture · Notifications · Profile. Capture is the dominant action. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", labelKey: "app.nav.home", icon: HomeIcon },
  { href: "/capture", labelKey: "app.nav.capture", icon: CaptureIcon, dominant: true },
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
 * above its icon, bold text, and aria-current for assistive technology. Capture keeps its Apricot circle in every state, and gains a ring
 * only when the grower is on the Capture page.
 */
export function PrimaryNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label={t("app.nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[max(env(safe-area-inset-bottom),0.5rem)] md:static md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4 items-end px-2 md:flex md:justify-center md:gap-2 md:px-4">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  item.dominant
                    ? `group flex flex-col items-center gap-1 py-2 text-sm text-text-brand no-underline ${
                        active ? "font-bold" : "font-medium"
                      }`
                    : `flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-control px-2 py-2 text-sm no-underline ${
                        active ? "font-bold text-text-brand" : "font-medium text-text-muted"
                      }`
                }
              >
                {item.dominant ? (
                  <span
                    className={`-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary transition-transform group-active:scale-95 md:-mt-0 md:h-12 md:w-12 ${
                      active ? "ring-4 ring-primary/30 ring-offset-2 ring-offset-surface" : ""
                    }`}
                  >
                    <Icon className="h-7 w-7 md:h-6 md:w-6" />
                  </span>
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className={`h-1 w-6 rounded-full ${active ? "bg-primary" : "invisible"}`}
                    />
                    <Icon className="h-6 w-6" />
                  </>
                )}
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
