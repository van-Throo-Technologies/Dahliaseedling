import type { ReactNode } from "react";
import { getTranslation } from "@/i18n/server";
import { getCurrentUser } from "@/modules/identity/session";
import { AppHeader } from "./app-header";
import { PrimaryNav } from "./primary-nav";

/**
 * Wraps every page. It decides what the header shows; it does not decide what a page may do.
 * Access rules live in the participation gate, not here.
 */
export async function AppShell({ children }: { readonly children: ReactNode }) {
  const user = await getCurrentUser();
  const { t } = await getTranslation();

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 text-text-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t("app.skip")}
      </a>
      <AppHeader signedIn={user !== null} />
      <PrimaryNav />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-12 md:pt-8">
        {children}
      </main>
    </>
  );
}
