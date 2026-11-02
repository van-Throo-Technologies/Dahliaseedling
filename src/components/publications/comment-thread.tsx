import { deleteCommentAction } from "@/modules/publications/actions";
import type { CommentNode } from "@/modules/publications/repository";
import { formatDate } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { CommentEditForm, CommentForm } from "./comment-form";

/*
 * Comments on one Update, in the order they were posted, with replies under the comment they answer.
 * A removed comment keeps its place in the thread, so the replies beneath it still make sense.
 * Disclosure elements open the reply and edit forms, so they work without JavaScript.
 */

export async function CommentThread({
  updateId,
  comments,
  canPost,
}: {
  readonly updateId: string;
  readonly comments: readonly CommentNode[];
  readonly canPost: boolean;
}) {
  const { t } = await getTranslation();
  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-4">
      <h2 id="comments-title" className="text-lg font-medium text-text">
        {t("publication.comments.title")}
      </h2>
      {comments.length === 0 ? (
        <p className="text-base text-text-muted">{t("publication.comments.none")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              updateId={updateId}
              node={comment}
              canPost={canPost}
              depth={0}
            />
          ))}
        </ul>
      )}
      {canPost ? (
        <CommentForm
          updateId={updateId}
          label={t("publication.comments.add")}
          submitLabel={t("publication.comments.post")}
        />
      ) : null}
    </section>
  );
}

async function CommentItem({
  updateId,
  node,
  canPost,
  depth,
}: {
  readonly updateId: string;
  readonly node: CommentNode;
  readonly canPost: boolean;
  readonly depth: number;
}) {
  const { t, locale } = await getTranslation();
  return (
    <li className={depth > 0 ? "ml-4 border-l border-border pl-4" : ""}>
      <article
        aria-label={t("publication.comments.byAuthor", { name: node.authorName })}
        className="flex flex-col gap-2"
      >
        <p className="text-sm text-text-muted">
          <span className="font-medium text-text">{node.authorName}</span> ·{" "}
          {formatDate(node.createdAt, locale)}
          {node.editedAt ? ` · ${t("publication.comments.edited")}` : null}
        </p>
        {node.isRemoved ? (
          <p className="text-base italic text-text-muted">{t("publication.comments.removed")}</p>
        ) : (
          <p className="whitespace-pre-line text-base text-text">{node.body}</p>
        )}

        {!node.isRemoved && node.isMine ? (
          <div className="flex flex-col gap-2">
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-base text-text-brand">
                {t("common.edit")}
              </summary>
              <div className="pt-2">
                <CommentEditForm updateId={updateId} commentId={node.id} body={node.body ?? ""} />
              </div>
            </details>
            <form action={deleteCommentAction}>
              <input type="hidden" name="updateId" value={updateId} />
              <input type="hidden" name="commentId" value={node.id} />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center text-base text-destructive underline"
              >
                {t("publication.comments.removeMine")}
              </button>
            </form>
          </div>
        ) : null}

        {!node.isRemoved && canPost ? (
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-base text-text-brand">
              {t("publication.comments.replyTo", { name: node.authorName })}
            </summary>
            <div className="pt-2">
              <CommentForm
                updateId={updateId}
                parentId={node.id}
                label={t("publication.comments.replyTo", { name: node.authorName })}
                submitLabel={t("publication.comments.postReply")}
              />
            </div>
          </details>
        ) : null}
      </article>
      {node.replies.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4">
          {node.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              updateId={updateId}
              node={reply}
              canPost={canPost}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
