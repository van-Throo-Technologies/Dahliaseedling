import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Thread } from "@/components/messaging/thread";
import { getTranslation } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { loadThread } from "@/modules/messaging/repository";
import { isUuid } from "@/modules/capture/validation";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("messaging.inbox.title") };
}

/*
 * One private conversation. Only its two participants can load it: the database returns nothing to anyone else, and that is
 * shown as "not found". Opening it marks it read for the reader only.
 */
export default async function ConversationPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { userId } = await requireParticipant(`/inbox/${id}`);
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const thread = await loadThread(supabase, userId, id);
  if (!thread) notFound();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: id });

  const query = await searchParams;
  const error = typeof query.messagingError === "string" ? query.messagingError : null;
  const notice = typeof query.messagingNotice === "string" ? query.messagingNotice : null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/inbox"
        className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
      >
        {t("messaging.thread.back")}
      </Link>
      <Thread thread={thread} returnTo={`/inbox/${id}`} error={error} notice={notice} />
    </div>
  );
}
