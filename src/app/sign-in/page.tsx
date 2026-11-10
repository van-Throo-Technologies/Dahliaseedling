import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormMessage } from "@/design-system/components/form-message";
import { SignInForm } from "@/components/identity/sign-in-form";
import { getTranslation } from "@/i18n/server";
import { safeNextPath } from "@/lib/http/safe-next";
import { getCurrentUser } from "@/modules/identity/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.signIn.title") };
}

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    next?: string | string[];
    confirm?: string | string[];
    reset?: string | string[];
  }>;
}) {
  const { next, confirm, reset } = await searchParams;
  const destination = safeNextPath(Array.isArray(next) ? next[0] : next, "/");
  const { t } = await getTranslation();

  // Already signed in: the gate on the destination decides what happens next.
  if (await getCurrentUser()) redirect(destination);

  // Set by the confirmation route when a link cannot be used. The code is never free text.
  const failure = Array.isArray(confirm) ? confirm[0] : confirm;
  const confirmation =
    failure === "expired"
      ? t("identity.confirm.expired")
      : failure === "invalid"
        ? t("identity.confirm.invalid")
        : null;

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("identity.signIn.title")}
        </h1>
        <p className="text-base text-text-muted">{t("identity.signIn.intro")}</p>
      </div>
      {confirmation ? <FormMessage tone="error">{confirmation}</FormMessage> : null}
      {(Array.isArray(reset) ? reset[0] : reset) === "1" ? (
        <FormMessage tone="success">{t("identity.recovery.resetDone")}</FormMessage>
      ) : null}
      <SignInForm next={destination} />
    </section>
  );
}
