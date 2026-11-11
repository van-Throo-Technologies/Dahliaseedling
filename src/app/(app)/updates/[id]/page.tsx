import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessagingFeedback } from "@/components/messaging/feedback-message";
import { ReportControl } from "@/components/safety/report-control";
import { CommentThread } from "@/components/publications/comment-thread";
import { UpdateCard } from "@/components/publications/update-card";
import { UpdateMenu } from "@/components/publications/update-menu";
import { FormMessage } from "@/design-system/components/form-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { getCurrentUser } from "@/modules/identity/session";
import { getPublicUpdate, listComments } from "@/modules/publications/repository";
import { isUuid } from "@/modules/capture/validation";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("publication.update.label") };
}

/**
 * One public Update, with its comments. An Update that is removed, or whose seedling, holder or author is not
 * public, is not found: the same answer a missing one gets.
 */
export default async function UpdatePage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{
    published?: string;
    error?: string;
    messagingNotice?: string;
    messagingError?: string;
  }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const query = await searchParams;
  const { t } = await getTranslation();

  const supabase = await createSupabaseServerClient();
  const update = await getPublicUpdate(supabase, id);
  if (!update) notFound();
  const [comments, viewer] = await Promise.all([listComments(supabase, id), getCurrentUser()]);
  const isAuthor = viewer !== null && viewer.id === update.authorId;

  return (
    <article className="flex flex-col gap-8" aria-label={t("publication.update.label")}>
      {query.published === "1" ? (
        <FormMessage tone="success">{t("publication.update.published")}</FormMessage>
      ) : null}
      {query.error === "delete" ? (
        <FormMessage tone="error">{t("errors.publication.updateNotRemoved")}</FormMessage>
      ) : null}

      <UpdateCard update={update} menu={isAuthor ? <UpdateMenu updateId={id} /> : undefined} />

      <MessagingFeedback error={query.messagingError} notice={query.messagingNotice} />
      {viewer && !isAuthor ? (
        <ReportControl
          targetType="update"
          targetId={id}
          returnTo={`/updates/${id}`}
          id="report-update"
        />
      ) : null}

      <CommentThread updateId={id} comments={comments} canPost canReport={viewer !== null} />
    </article>
  );
}
