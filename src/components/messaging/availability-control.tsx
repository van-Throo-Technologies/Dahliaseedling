import Link from "next/link";
import { getTranslation } from "@/i18n/server";
import { setAvailabilityAction } from "@/modules/messaging/actions";

/*
 * "Notify me if available" for one public Seedling. It is a yes or no choice, not a conversation, and it tells the grower
 * exactly what they will be told. The holder sees a plain note instead, since there is nothing to subscribe to.
 */

interface AvailabilityControlProps {
  readonly seedlingId: string;
  readonly returnTo: string;
  readonly subscribed: boolean;
  readonly signedIn: boolean;
  readonly isHolder: boolean;
  readonly id: string;
}

export async function AvailabilityControl({
  seedlingId,
  returnTo,
  subscribed,
  signedIn,
  isHolder,
  id,
}: AvailabilityControlProps) {
  const { t } = await getTranslation();
  if (isHolder)
    return <p className="text-base text-text-muted">{t("messaging.availability.holder")}</p>;
  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(returnTo)}`}
        className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
      >
        {t("messaging.availability.signIn")}
      </Link>
    );
  }
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2">
      <h2 id={`${id}-title`} className="sr-only">
        {t("messaging.availability.notify")}
      </h2>
      <p className="text-base text-text-muted">
        {t(subscribed ? "messaging.availability.on" : "messaging.availability.off")}
      </p>
      <form action={setAvailabilityAction}>
        <input type="hidden" name="seedlingId" value={seedlingId} />
        <input type="hidden" name="subscribe" value={subscribed ? "0" : "1"} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface px-4 py-2 text-base font-medium text-text-brand transition-colors hover:border-text-brand"
        >
          {t(subscribed ? "messaging.availability.stop" : "messaging.availability.notify")}
        </button>
      </form>
    </section>
  );
}
