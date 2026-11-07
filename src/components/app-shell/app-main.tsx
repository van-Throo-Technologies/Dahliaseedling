"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/*
 * The page column. Home is the Feed, which uses the wider desktop column so the photographs have room; every other page keeps the
 * narrower form width, so forms and reading text are not stretched.
 */
export function AppMain({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const width = pathname === "/" ? "max-w-5xl" : "max-w-2xl";

  return (
    <main id="main" className={`mx-auto w-full ${width} px-4 pb-28 pt-6 md:pb-12 md:pt-8`}>
      {children}
    </main>
  );
}
