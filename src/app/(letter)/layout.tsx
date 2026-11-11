import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/brand";

/*
 * The personal letter's own frame. It carries the simple identity and nothing else: no account links, no navigation, and no application
 * footer. Existing members reach the application through its own pages, and the letter points there only from its closing invitation.
 */
export default function LetterLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto w-full max-w-5xl px-4 pb-4 pt-6 sm:px-8 sm:pt-8">
        <p className="font-display text-xl text-text-brand">{APP_NAME}</p>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-8 sm:pb-24">
        {children}
      </main>
    </div>
  );
}
