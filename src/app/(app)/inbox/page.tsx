import type { Metadata } from "next";
import { InboxList } from "@/components/messaging/inbox-list";
import { getTranslation } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { listInbox } from "@/modules/messaging/repository";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("messaging.inbox.title") };
}

/*
 * The Inbox lists private conversations for the signed-in grower. Each row is one conversation, about one context. Messages
 * are not notifications: nothing here is a request for attention, and the notification list is separate.
 */
export default async function InboxPage() {
  const { userId } = await requireParticipant("/inbox");
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const rows = await listInbox(supabase, userId);

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("messaging.inbox.title")}
        </h1>
        <p className="text-base text-text-muted">{t("messaging.inbox.intro")}</p>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-control border border-border bg-surface p-4">
          <p className="font-medium text-text">{t("messaging.inbox.empty")}</p>
          <p className="text-base text-text-muted">{t("messaging.inbox.emptyText")}</p>
        </div>
      ) : (
        <InboxList rows={rows} />
      )}
    </section>
  );
}
