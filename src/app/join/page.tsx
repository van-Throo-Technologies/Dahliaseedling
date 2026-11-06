import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { InvitationRequestForm } from "@/components/invitations/request-form";
import { getTranslation } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("invitations.join.title"), robots: { index: false, follow: false } };
}

const STORY_PARAGRAPHS = [
  "invitations.join.story1",
  "invitations.join.story2",
  "invitations.join.story3",
  "invitations.join.story4",
  "invitations.join.story5",
  "invitations.join.story6",
] as const;

/*
 * The public entry point for invitation requests. It exists only while INVITATION_REQUESTS_ENABLED is "true". Any other value, or none,
 * makes it not found, so the feature can be switched off without a code change. The variable is read at request time and is not a
 * secret.
 *
 * The layout is mobile-first. The hero uses the Apricot primary with dark text, which is the project's rule for text on Apricot. Its
 * button jumps to the form, so the form is one tap away on a phone and needs no scrolling hunt. The page reads fully without any image:
 * the photograph, when supplied, is an addition and never a requirement.
 */
export default async function JoinPage() {
  if (process.env.INVITATION_REQUESTS_ENABLED !== "true") notFound();

  const { t } = await getTranslation();
  return (
    <div className="flex flex-col gap-10">
      <section
        aria-labelledby="page-title"
        className="grid gap-8 rounded-control bg-primary px-5 py-10 text-on-primary sm:px-10 sm:py-14 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:gap-x-10"
      >
        <figure className="order-first m-0 md:col-start-2 md:row-span-2 md:row-start-2">
          {/* The original photograph, served byte-for-byte: no crop, no re-encoding, so the flower looks exactly as shot. */}
          <Image
            src="/images/dahlia-founder.jpg"
            width={1536}
            height={2048}
            alt={t("invitations.join.heroAlt")}
            priority
            unoptimized
            sizes="(min-width: 768px) 22rem, 100vw"
            className="h-auto w-full rounded-control border-4 border-background"
          />
        </figure>
        <h1
          id="page-title"
          className="font-display text-3xl leading-tight sm:text-5xl md:col-span-2 md:row-start-1"
        >
          {t("invitations.join.heroHeading")}
        </h1>
        <div className="flex flex-col gap-5 md:col-start-1 md:row-start-2 md:row-span-2">
          <p className="max-w-prose text-base sm:text-lg">{t("invitations.join.intro")}</p>
          <a
            href="#request"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-text-brand px-5 py-2 text-base font-medium text-background sm:w-auto"
          >
            {t("invitations.join.requestCta")}
          </a>
        </div>
      </section>

      <article
        aria-labelledby="story-title"
        className="flex flex-col gap-4 rounded-control border border-border bg-surface p-5 sm:p-8"
      >
        <h2 id="story-title" className="font-display text-2xl text-text-brand">
          {t("invitations.join.storyHeading")}
        </h2>
        {STORY_PARAGRAPHS.map((key) => (
          <p key={key} className="max-w-prose text-base text-text">
            {t(key)}
          </p>
        ))}
        <p className="max-w-prose text-base font-medium text-text">
          {t("invitations.join.story7")}
        </p>
        <p className="text-base text-text">
          {t("invitations.join.signOffLead")}
          <br />
          {t("invitations.join.signOffName")}
          <br />
          <span className="text-text-muted">{t("invitations.join.signOffRole")}</span>
        </p>
      </article>

      <section
        id="request"
        aria-labelledby="request-title"
        className="flex scroll-mt-6 flex-col gap-4"
      >
        <h2 id="request-title" className="font-display text-2xl text-text-brand">
          {t("invitations.join.title")}
        </h2>
        <p className="max-w-prose text-base text-text-muted">{t("invitations.join.privacyNote")}</p>
        <InvitationRequestForm />
      </section>
    </div>
  );
}
