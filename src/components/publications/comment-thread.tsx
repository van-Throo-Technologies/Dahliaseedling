import { ReportControl } from "@/components/safety/report-control";
import { formatCount, formatDate } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { displayedName } from "@/modules/identity/former-grower";
import type { CommentNode } from "@/modules/publications/repository";
import { CommentBranch } from "./comment-branch";
import { CommentForm, ReplyForm } from "./comment-form";
import { CommentOptions } from "./comment-options";

/*
 * Comments on one Update, in the order they were posted. The composer sits directly beneath the list, so nothing has to be opened to
 * write. A Feed card can show only the most recent comments; its "View all comments" link opens the full discussion. Each comment has a
 * compact Reply disclosure, and its replies sit under a "View N replies" disclosure that starts collapsed. A removed comment keeps its
 * place, so the replies beneath it still make sense. Only the author sees the three-dot menu; the database checks ownership on every
 * change. The disclosures work without JavaScript.
 */

export async function CommentThread({
  updateId,
  comments,
  canPost,
  canReport,
  limit,
  composer = true,
  sectionId = "comments",
}: {
  readonly updateId: string;
  readonly comments: readonly CommentNode[];
  readonly canPost: boolean;
  /** Signed-in readers may report other growers' comments. Visitors see no report control. */
  readonly canReport: boolean;
  /** Shows only the most recent this many comments. Omitted, every comment is shown. */
  readonly limit?: number;
  /** False when the caller provides its own composer, as the Feed card does. */
  readonly composer?: boolean;
  /** The section's id. Several discussions can share a page, so each must have its own. The Update page keeps "comments" for its links. */
  readonly sectionId?: string;
}) {
  const { t } = await getTranslation();
  const shown = limit ? comments.slice(-limit) : comments;
  const titleId = `${sectionId}-title`;
  return (
    <section id={sectionId} aria-labelledby={titleId} className="flex flex-col gap-3 scroll-mt-20">
      <h2 id={titleId} className="sr-only">
        {t("publication.comments.title")}
      </h2>
      {comments.length === 0 ? (
        <p className="text-base text-text-muted">{t("publication.comments.none")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((comment) => (
            <CommentItem
              key={comment.id}
              updateId={updateId}
              node={comment}
              canPost={canPost}
              canReport={canReport}
              depth={0}
            />
          ))}
        </ul>
      )}
      {canPost && composer ? (
        <div className="pt-1">
          <CommentForm
            updateId={updateId}
            label={t("publication.comments.yourComment")}
            submitLabel={t("publication.comments.send")}
            submitOnEnter
          />
        </div>
      ) : null}
    </section>
  );
}

async function CommentItem({
  updateId,
  node,
  canPost,
  canReport,
  depth,
}: {
  readonly updateId: string;
  readonly node: CommentNode;
  readonly canPost: boolean;
  readonly canReport: boolean;
  readonly depth: number;
}) {
  const { t, locale } = await getTranslation();
  const name = displayedName(node.authorName, t("privacy.formerGrower"));
  const byline = (
    <p className="text-sm text-text-muted">
      <span className="font-medium text-text">{name}</span> · {formatDate(node.createdAt, locale)}
      {node.editedAt ? ` · ${t("publication.comments.edited")}` : null}
    </p>
  );
  const replyCount = node.replies.length;
  const summary =
    replyCount === 1
      ? t("publication.comments.viewReplies.one")
      : t("publication.comments.viewReplies.other", { count: formatCount(replyCount, locale) });
  const replies = (
    <ul className="mt-2 flex flex-col gap-4">
      {node.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          updateId={updateId}
          node={reply}
          canPost={canPost}
          canReport={canReport}
          depth={depth + 1}
        />
      ))}
    </ul>
  );

  return (
    <li className={depth > 0 ? "ml-3 border-l border-border pl-3" : ""}>
      <CommentBranch replyCount={replyCount} summary={summary} replies={replies}>
        <article
          aria-label={t("publication.comments.byAuthor", { name })}
          className="flex flex-col gap-1"
        >
          {node.isRemoved ? (
            <>
              {byline}
              <p className="text-base italic text-text-muted">
                {t("publication.comments.removed")}
              </p>
            </>
          ) : node.isMine ? (
            <CommentOptions
              updateId={updateId}
              commentId={node.id}
              body={node.body ?? ""}
              byline={byline}
            />
          ) : (
            <>
              {byline}
              <p className="whitespace-pre-line text-base text-text">{node.body}</p>
            </>
          )}

          {/* Reply and Report share a line. A disclosure that is open takes the whole line, so its form has room. */}
          <div className="flex flex-wrap items-start gap-x-4">
            {!node.isRemoved && canPost ? (
              <details className="open:basis-full">
                <summary className="inline-flex min-h-11 min-w-11 cursor-pointer items-center text-base font-medium text-text-brand">
                  {t("publication.comments.reply")}
                </summary>
                <div className="pt-2">
                  <ReplyForm
                    updateId={updateId}
                    parentId={node.id}
                    label={t("publication.comments.replyTo", { name })}
                    submitLabel={t("publication.comments.postReply")}
                  />
                </div>
              </details>
            ) : null}

            {!node.isRemoved && !node.isMine && canReport ? (
              <ReportControl
                targetType="comment"
                targetId={node.id}
                returnTo={`/updates/${updateId}`}
                id={`report-comment-${node.id}`}
                className="open:basis-full"
              />
            ) : null}
          </div>
        </article>
      </CommentBranch>
    </li>
  );
}
