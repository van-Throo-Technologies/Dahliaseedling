import { ButtonLink } from "@/design-system/components/button-link";
import { getOwnProfile } from "@/modules/identity/session";

export default async function HomePage() {
  const profile = await getOwnProfile();

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="home-title" className="flex flex-col gap-3">
        <h1
          id="home-title"
          className="font-display text-3xl leading-tight text-text-brand sm:text-4xl"
        >
          {profile
            ? `Welcome back, ${profile.displayName}.`
            : "The gardener gardens. DahliaSeedling remembers."}
        </h1>
        {profile ? null : (
          <p className="text-base text-text-muted">
            Browse freely. Create an account when you want to document your own Seedlings, share
            them, or take part.
          </p>
        )}
      </section>

      <section
        aria-labelledby="feed-title"
        className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4"
      >
        <h2 id="feed-title" className="text-lg font-medium text-text">
          Nothing has been shared yet
        </h2>
        <p className="text-base text-text-muted">
          Public Updates and search will appear here as the community grows.
        </p>
      </section>

      {profile ? null : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/sign-up">Create an account</ButtonLink>
          <ButtonLink href="/sign-in" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
