import Link from "next/link";
import { formatDateTime } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import type { NotificationRow } from "@/modules/messaging/repository";

/*
 * The notification list. Each row is one typed sentence with the actor's name where it is known. A notification points at
 * what happened; it never repeats message text, and it does not appear in the Inbox.
 */

const TYPE_KEY: Record<string, MessageKey> = {
  comment: "notifications.types.comment",
  reply: "notifications.types.reply",
  message: "notifications.types.message",
  rehome_interest: "notifications.types.rehome_interest",
  rehome_selected: "notifications.types.rehome_selected",
  rehome_sent: "notifications.types.rehome_sent",
  rehome_received: "notifications.types.rehome_received",
  seed_offer_interest: "notifications.types.seed_offer_interest",
  followed_seedling_update: "notifications.types.followed_seedling_update",
  availability_trigger: "notifications.types.availability_trigger",
};

export async function NotificationList({ rows }: { readonly rows: readonly NotificationRow[] }) {
  const { t, locale } = await getTranslation();
  const anyUnread = rows.some((row) => row.unread);
  return (
    <div className="space-y-4">
      {anyUnread ? (
        <form action={markAllNotificationsReadAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 py-2 text-base font-medium text-text-brand"
          >
            {t("notifications.markAll")}
          </button>
        </form>
      ) : null}
      <ul className="divide-y divide-border rounded-control border border-border bg-surface">
        {rows.map((row) => {
          const key = TYPE_KEY[row.type];
          const sentence = key
            ? t(key, { name: row.actorName ?? t("notifications.someone") })
            : t("notifications.someone");
          return (
            <li key={row.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p
                  className={`text-base ${row.unread ? "font-medium text-text" : "text-text-muted"}`}
                >
                  {row.href ? (
                    <Link href={row.href} className="text-text no-underline hover:underline">
                      {sentence}
                    </Link>
                  ) : (
                    sentence
                  )}
                </p>
                {row.unread ? (
                  <span className="shrink-0 rounded-control bg-primary px-2 py-0.5 text-sm font-medium text-on-primary">
                    {t("notifications.unread")}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <time dateTime={row.createdAt} className="text-sm text-text-muted">
                  {formatDateTime(row.createdAt, locale)}
                </time>
                {row.unread ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={row.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center text-sm text-text-brand underline underline-offset-4"
                    >
                      {t("notifications.markRead")}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
