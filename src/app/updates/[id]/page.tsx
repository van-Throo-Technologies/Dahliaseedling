import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/publications/comment-thread";
import { UpdateCard } from "@/components/publications/update-card";
import { FormMessage } from "@/design-system/components/form-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTranslation } from "@/i18n/server";
import { getCurrentUser } from "@/modules/identity/session";
import { deleteUpdateAction } from "@/modules/publications/actions";
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
  readonly searchParams: Promise<{ published?: string; error?: string }>;
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

      <UpdateCard update={update} />

      {isAuthor ? (
        <section aria-labelledby="manage-title" className="flex flex-col gap-3">
          <h2 id="manage-title" className="text-lg font-medium text-text">
            {t("publication.update.manage")}
          </h2>
          <p className="text-base text-text-muted">{t("publication.update.manageText")}</p>
          <form action={deleteUpdateAction}>
            <input type="hidden" name="updateId" value={id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-control border border-destructive px-4 text-base font-medium text-destructive"
            >
              {t("publication.update.remove")}
            </button>
          </form>
        </section>
      ) : null}

      <CommentThread updateId={id} comments={comments} canPost />
    </article>
  );
}
