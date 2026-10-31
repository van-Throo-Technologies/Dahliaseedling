import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { dmSans, fraunces } from "@/design-system/fonts";
import { strings } from "@/content/strings";
import "./globals.css";

export const metadata: Metadata = {
  title: strings.appName,
  description: strings.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={strings.locale} className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-text antialiased">{children}</body>
    </html>
  );
}
