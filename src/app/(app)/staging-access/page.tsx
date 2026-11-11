import type { Metadata } from "next";
import { FormMessage } from "@/design-system/components/form-message";
import { STAGING_GATE_LOGIN_ACTION, safeNextPath } from "@/lib/security/staging-gate";

export const metadata: Metadata = {
  title: "Testing access",
  robots: { index: false, follow: false },
};

/*
 * The testing gate for the staging deployment. It asks only for the shared testing password. It contains no secret, and the password is
 * checked on the server by the form's handler, never here.
 */
export default async function StagingAccessPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = safeNextPath(Array.isArray(query.next) ? query.next[0] : query.next);
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const failed = error === "1";
  const limited = error === "limited";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight text-text-brand">DahliaSeedling</h1>
        <p className="text-base text-text-muted">
          This is a testing copy. Enter the testing password to continue.
        </p>
      </header>

      {failed ? (
        <FormMessage tone="error">That password is not right. Try again.</FormMessage>
      ) : null}
      {limited ? (
        <FormMessage tone="error">
          Too many attempts from this connection. Wait 15 minutes, then try again.
        </FormMessage>
      ) : null}

      <form action={STAGING_GATE_LOGIN_ACTION} method="post" className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-2 text-base font-medium text-text">
          Testing password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 rounded-control border border-border bg-surface px-3 text-base text-text"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-control bg-primary px-4 text-base font-medium text-on-primary"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
