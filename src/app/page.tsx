import { ButtonLink } from "@/design-system/components/button-link";
import { strings } from "@/content/strings";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl leading-tight text-text-brand sm:text-5xl">
          {strings.appName}
        </h1>
        {/* Decorative accent only. Apricot is never used for text (it fails contrast on porcelain). */}
        <div aria-hidden="true" className="h-1 w-12 rounded-full bg-primary" />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xl font-medium text-text">{strings.home.foundation}</p>
        <p className="text-base text-text-muted">{strings.home.note}</p>
      </div>

      <div>
        <ButtonLink href="/api/health" variant="secondary">
          {strings.home.statusAction}
        </ButtonLink>
      </div>
    </main>
  );
}
