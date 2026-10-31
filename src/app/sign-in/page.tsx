import { redirect } from "next/navigation";
import { SignInForm } from "@/components/identity/sign-in-form";
import { safeNextPath } from "@/lib/http/safe-next";
import { getCurrentUser } from "@/modules/identity/session";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");

  // Already signed in: the gate on the destination decides what happens next.
  if (await getCurrentUser()) redirect(destination);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          Sign in
        </h1>
        <p className="text-base text-text-muted">
          An account lets you document Seedlings, share Updates and take part in the community.
        </p>
      </div>
      <SignInForm next={destination} />
    </section>
  );
}
