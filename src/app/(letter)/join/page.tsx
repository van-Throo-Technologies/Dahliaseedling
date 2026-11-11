import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/design-system/components/button-link";
import { setLocaleAction } from "@/i18n/actions";
import { getTranslation } from "@/i18n/server";
import { LOCALE_NAMES, LOCALES } from "@/i18n/locales";

/*
 * The personal landing page: a letter from the founder to other dahlia growers. It is public, needs no sign-in, and is the page shared on
 * Facebook, WhatsApp and Messenger. Its layout is the letter's own (see the (letter) layout), so none of the application's controls appear.
 *
 * On a phone the title and the opening paragraph come first, and the photograph follows at a width that leaves the first screen for the
 * words. On a desktop the opening sits beside the photograph, and the rest of the letter runs in a comfortable reading column.
 *
 * Social previews use the 1200 × 630 image in /images/og-join.jpg, cut from the same approved photograph.
 */

const REST_OF_LETTER = ["p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"] as const;

const SITE_URL = process.env.APP_BASE_URL?.trim() || "https://dahliaseedling.app";
const SOCIAL_IMAGE = "/images/og-join.jpg";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  const title = t("landing.title");
  const description = t("landing.description");
  const image = { url: SOCIAL_IMAGE, width: 1200, height: 630, alt: t("landing.photoAlt") };
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: "/join" },
    openGraph: {
      title,
      description,
      url: "/join",
      siteName: "DahliaSeedling",
      type: "article",
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE] },
  };
}

export default async function JoinPage() {
  const { t, locale } = await getTranslation();
  return (
    <article className="flex flex-col gap-10 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:gap-x-16 md:gap-y-10">
      <header className="flex flex-col gap-5 md:col-start-1 md:row-start-1">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-text-muted">
          {t("landing.kicker")}
        </p>
        <h1 className="font-display text-4xl leading-tight text-balance text-text-brand md:text-5xl">
          {t("landing.title")}
        </h1>
        <p className="text-lg leading-relaxed md:text-xl">{t("landing.p1")}</p>
      </header>

      <figure className="m-0 mx-auto w-[70%] sm:w-[58%] md:col-start-2 md:row-span-2 md:row-start-1 md:mx-0 md:w-full md:self-start">
        {/* The approved photograph, served byte-for-byte so the flower looks exactly as shot. */}
        <Image
          src="/images/founder-seedling.jpg"
          width={1040}
          height={1387}
          alt={t("landing.photoAlt")}
          priority
          unoptimized
          sizes="(min-width: 768px) 21rem, 70vw"
          className="h-auto w-full rounded-control"
        />
      </figure>

      <div className="flex max-w-[40rem] flex-col gap-6 text-lg leading-relaxed md:col-start-1 md:row-start-2 md:text-xl">
        {REST_OF_LETTER.map((key) => (
          <p key={key}>{t(`landing.${key}`)}</p>
        ))}
      </div>

      <div className="flex max-w-[40rem] flex-col gap-8 md:col-span-2 md:row-start-3">
        <p className="font-display text-2xl text-text-brand">{t("landing.signature")}</p>
        <div className="flex flex-col items-start gap-4">
          <ButtonLink href="/sign-up">{t("landing.primaryCta")}</ButtonLink>
          <Link href="/" className="font-medium text-text-brand underline underline-offset-4">
            {t("landing.secondaryCta")}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted md:col-span-2 md:row-start-4">
        {LOCALES.map((code) =>
          code === locale ? (
            <span key={code} lang={code} aria-current="true" className="font-medium text-text">
              {LOCALE_NAMES[code]}
            </span>
          ) : (
            <form key={code} action={setLocaleAction}>
              <input type="hidden" name="returnTo" value="/join" />
              <button
                type="submit"
                name="locale"
                value={code}
                lang={code}
                className="underline underline-offset-4 hover:text-text-brand"
              >
                {LOCALE_NAMES[code]}
              </button>
            </form>
          ),
        )}
      </div>
    </article>
  );
}
