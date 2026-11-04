import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { dmSans, fraunces } from "@/design-system/fonts";
import { LocaleProvider } from "@/i18n/client";
import { getTranslation } from "@/i18n/server";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

// Every page depends on the visitor's session (header state, participation gates, own profile).
// Nothing may be prerendered once and then shared between visitors.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return {
    title: APP_NAME,
    description: t("app.description"),
    manifest: "/manifest.webmanifest",
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "Dahlia", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout use the safe-area insets on notched phones.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { locale, messages } = await getTranslation();
  return (
    <html lang={locale} className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-text antialiased">
        <LocaleProvider locale={locale} messages={messages}>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
