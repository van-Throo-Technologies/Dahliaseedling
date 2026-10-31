import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { strings } from "@/content/strings";
import { dmSans, fraunces } from "@/design-system/fonts";
import "./globals.css";

// Every page depends on the visitor's session (header state, participation gates, own profile).
// Nothing may be prerendered once and then shared between visitors.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: strings.appName,
  description: strings.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout use the safe-area insets on notched phones.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={strings.locale} className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-text antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
