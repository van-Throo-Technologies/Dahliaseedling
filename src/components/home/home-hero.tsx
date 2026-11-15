import Image from "next/image";
import Link from "next/link";
import { getTranslation } from "@/i18n/server";

/*
 * The Home header: the founder's real first-bloom seedling, the headline, and an introduction with a route to Explore. A visitor sees the
 * whole header. A signed-in member sees one compact line instead, so the Feed is not pushed down by a banner on every visit.
 */
export async function HomeHero({ signedIn }: { readonly signedIn: boolean }) {
  const { t } = await getTranslation();
  const explore = (
    <Link
      href="/explore"
      className="inline-flex min-h-11 w-fit items-center rounded-control bg-primary px-5 text-base font-medium text-on-primary transition-colors hover:brightness-95"
    >
      {t("publication.feed.explore")}
    </Link>
  );

  if (signedIn) {
    return (
      <section
        aria-label={t("publication.hero.title")}
        className="flex flex-wrap items-center justify-between gap-3 rounded-surface border border-border bg-surface px-4 py-3"
      >
        <p className="font-display text-lg font-semibold text-text-brand">
          {t("publication.hero.title")}
        </p>
        {explore}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="home-hero-title"
      className="overflow-hidden rounded-surface border border-border bg-surface"
    >
      <div className="relative aspect-[1800/640] w-full bg-background">
        <Image
          src="/images/home/hero-real-seedling-1800x640.webp"
          alt={t("publication.hero.alt")}
          fill
          priority
          sizes="(min-width: 1400px) 40rem, 100vw"
          className="object-cover object-[80%_50%]"
        />
      </div>
      <div className="flex flex-col gap-2 p-4 sm:gap-3 sm:p-6">
        <h2
          id="home-hero-title"
          className="font-display text-2xl font-semibold text-balance text-text-brand sm:text-4xl"
        >
          {t("publication.hero.title")}
        </h2>
        <p className="max-w-prose text-sm text-text sm:text-base">{t("publication.hero.intro")}</p>
        {explore}
      </div>
    </section>
  );
}
