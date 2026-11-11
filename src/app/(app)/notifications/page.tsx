import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { getTranslation } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { listNotifications } from "@/modules/messaging/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("notifications.title") };
}

/*
 * Notifications are attention signals for the signed-in grower: comments, interest, selection, arrivals and availability.
 * They name what happened and link to it. They never carry message text, and the Inbox is separate.
 */
export default async function NotificationsPage() {
  await requireParticipant("/notifications");
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const rows = await listNotifications(supabase);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("notifications.title")}
        </h1>
        <p className="text-base text-text-muted">{t("notifications.intro")}</p>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-control border border-border bg-surface p-4">
          <p className="font-medium text-text">{t("notifications.empty")}</p>
          <p className="text-base text-text-muted">{t("notifications.emptyText")}</p>
        </div>
      ) : (
        <NotificationList rows={rows} />
      )}
    </section>
  );
}
