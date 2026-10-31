import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/identity/sign-up-form";
import { safeNextPath } from "@/lib/http/safe-next";
import { getCurrentUser } from "@/modules/identity/session";

export const metadata = { title: "Create an account" };

export default async function SignUpPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");

  if (await getCurrentUser()) redirect(destination);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          Create an account
        </h1>
        <p className="text-base text-text-muted">
          You will set up your profile next. Only your display name and country are required.
        </p>
      </div>
      <SignUpForm next={destination} />
    </section>
  );
}
