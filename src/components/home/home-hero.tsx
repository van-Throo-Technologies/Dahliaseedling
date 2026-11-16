import Image from "next/image";
import Link from "next/link";
import { getTranslation } from "@/i18n/server";

/*
 * The Home header. A visitor sees one photographic hero: the founder's real dahlia seedling on the right, with the headline, the
 * introduction and the actions set over the darker left side of the same photograph. A signed-in member sees one compact line instead,
 * so the Feed is not pushed down on every visit.
 */
export async function HomeHero({ signedIn }: { readonly signedIn: boolean }) {
  const { t } = await getTranslation();

  if (signedIn) {
    return (
      <section
        aria-label={t("publication.hero.title")}
        className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-border bg-surface px-4 py-3"
      >
        <p className="font-display text-lg font-semibold text-text-brand">
          {t("publication.hero.title")}
        </p>
        <Link
          href="/explore"
          className="inline-flex min-h-11 w-fit items-center rounded-control bg-primary px-5 text-base font-medium text-on-primary transition-colors hover:brightness-95"
        >
          {t("publication.feed.explore")}
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate flex min-h-[300px] items-center overflow-hidden rounded-surface bg-text-brand sm:min-h-[360px]"
    >
      <Image
        src="/images/home/hero-real-seedling-1800x640.webp"
        alt={t("publication.hero.alt")}
        fill
        priority
        sizes="(min-width: 1400px) 40rem, 100vw"
        className="-z-10 object-cover object-[80%_50%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-text-brand/90 via-text-brand/55 to-transparent"
      />
      <div className="flex max-w-[68%] flex-col gap-3 p-5 sm:max-w-[60%] sm:gap-4 sm:p-8">
        <h2
          id="home-hero-title"
          className="font-display text-3xl font-semibold leading-tight text-balance text-background sm:text-4xl"
        >
          {t("publication.hero.title")}
        </h2>
        <p className="text-sm text-background/90 sm:text-base">{t("publication.hero.intro")}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/explore"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-base font-medium text-on-primary transition-colors hover:brightness-95"
          >
            {t("publication.feed.explore")} →
          </Link>
          <Link
            href="/capture"
            className="inline-flex min-h-11 items-center rounded-control border border-background px-5 text-base font-medium text-background transition-colors hover:bg-background/10"
          >
            {t("app.nav.capture")}
          </Link>
        </div>
      </div>
    </section>
  );
}
