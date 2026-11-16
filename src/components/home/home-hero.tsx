import Image from "next/image";
import Link from "next/link";
import { getTranslation } from "@/i18n/server";

/*
 * The Home header, for visitors and members alike: one photographic hero with the founder's real dahlia seedling on the right. The
 * headline, the introduction and the actions sit over the deep botanical green on the left, so the text stays readable while the flower
 * and bud keep their colours. It stays inside the Feed column, so the discovery sidebar keeps its place.
 */
export async function HomeHero() {
  const { t } = await getTranslation();
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate flex min-h-[300px] items-center overflow-hidden rounded-surface bg-hero-green min-[1400px]:min-h-[440px]"
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
        className="absolute inset-0 -z-10 bg-gradient-to-r from-hero-green/95 via-hero-green/60 to-transparent"
      />
      <div className="flex max-w-[68%] flex-col gap-3 p-5 sm:max-w-[60%] sm:gap-4 sm:p-8 min-[1400px]:p-10">
        <h2
          id="home-hero-title"
          className="font-display text-3xl font-semibold leading-tight text-balance text-background sm:text-4xl min-[1400px]:text-5xl"
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
