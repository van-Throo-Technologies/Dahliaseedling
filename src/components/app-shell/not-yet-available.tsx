/**
 * Restrained placeholder for destinations whose feature arrives in a later phase. It states the
 * fact without faking content, and never implies data exists.
 */
export function NotYetAvailable({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-4">
      <h1 id="page-title" className="font-display text-3xl text-text-brand">
        {title}
      </h1>
      <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
        {message}
      </p>
    </section>
  );
}
