import { DM_Sans, Fraunces } from "next/font/google";

/*
 * DM Sans is the functional interface face. Fraunces is for brand and editorial moments only.
 * next/font self-hosts both at build time, so no third-party font request happens in the browser.
 */
export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
