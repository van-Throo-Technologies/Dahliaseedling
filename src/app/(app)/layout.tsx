import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";

/*
 * The application's pages: the header, the primary navigation and the footer. The personal letter at /join sits in its own route group
 * with its own layout, so it never shows these controls. Route groups do not change any address.
 */
export default function ApplicationLayout({ children }: { readonly children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
