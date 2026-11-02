import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/publications/comment-thread";
import { UpdateCard } from "@/components/publications/update-card";
import { FormMessage } from "@/design-system/components/form-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/identity/session";
import { deleteUpdateAction } from "@/modules/publications/actions";
import { getPublicUpdate, listComments } from "@/modules/publications/repository";
import { isUuid } from "@/modules/capture/validation";

export const metadata: Metadata = { title: "Update" };

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

  const supabase = await createSupabaseServerClient();
  const update = await getPublicUpdate(supabase, id);
  if (!update) notFound();
  const [comments, viewer] = await Promise.all([listComments(supabase, id), getCurrentUser()]);
  const isAuthor = viewer !== null && viewer.id === update.authorId;

  return (
    <article className="flex flex-col gap-8" aria-label="Update">
      {query.published === "1" ? (
        <FormMessage tone="success">
          Published. Visitors can now see this Update on the Feed and on the seedling&apos;s page.
        </FormMessage>
      ) : null}
      {query.error === "delete" ? (
        <FormMessage tone="error">This update could not be removed. Try again.</FormMessage>
      ) : null}

      <UpdateCard update={update} />

      {isAuthor ? (
        <section aria-labelledby="manage-title" className="flex flex-col gap-3">
          <h2 id="manage-title" className="text-lg font-medium text-text">
            Manage this update
          </h2>
          <p className="text-base text-text-muted">
            Removing it takes it off the Feed and the seedling&apos;s page. Your observation stays
            private and unchanged.
          </p>
          <form action={deleteUpdateAction}>
            <input type="hidden" name="updateId" value={id} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-control border border-destructive px-4 text-base font-medium text-destructive"
            >
              Remove this update
            </button>
          </form>
        </section>
      ) : null}

      <CommentThread updateId={id} comments={comments} canPost />
    </article>
  );
}
