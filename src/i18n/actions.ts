"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/http/safe-next";
import { isLocale, LOCALE_COOKIE } from "./locales";

/**
 * Saves the visitor's language choice and returns them to the same page. The public address does not change.
 * The cookie is read on the server, so the next render is already in the new language.
 */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(formData.get("returnTo"), "/");
  const locale = formData.get("locale");
  if (isLocale(locale)) {
    const jar = await cookies();
    jar.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  redirect(returnTo);
}
