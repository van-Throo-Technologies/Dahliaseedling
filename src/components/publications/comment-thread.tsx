import { ReportControl } from "@/components/safety/report-control";
import { formatCount, formatDate } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import { displayedName } from "@/modules/identity/former-grower";
import type { CommentNode } from "@/modules/publications/repository";
import { CommentBranch } from "./comment-branch";
import { CommentForm, ReplyForm } from "./comment-form";
import { CommentOptions } from "./comment-options";
import { InitialsAvatar } from "./initials-avatar";

/*
 * Comments on one Update, in the order they were posted. The page variant is the Update page: the composer sits directly beneath the
 * list. The conversation variant is the dialog opened from a Feed card: each comment has an avatar and sits in a soft bubble, the
 * grower's comments carry a Grower tag, and the replies are compact. A removed comment keeps its place, so the replies beneath it still
 * make sense. Only the author sees the three-dot menu; the database checks ownership on every change. The disclosures work without
 * JavaScript.
 */

export async function CommentThread({
  updateId,
  comments,
  canPost,
  canReport,
  limit,
  composer = true,
  sectionId = "comments",
  variant = "page",
  growerId,
}: {
  readonly updateId: string;
  readonly comments: readonly CommentNode[];
  readonly canPost: boolean;
  /** Signed-in readers may report other growers' comments. Visitors see no report control. */
  readonly canReport: boolean;
  /** Shows only the most recent this many comments. Omitted, every comment is shown. */
  readonly limit?: number;
  /** False when the caller provides its own composer, as the conversation dialog does. */
  readonly composer?: boolean;
  /** The section's id. Several discussions can share a page, so each must have its own. The Update page keeps "comments" for its links. */
  readonly sectionId?: string;
  readonly variant?: "page" | "conversation";
  /** The Update's author, whose comments carry the Grower tag in the conversation. */
  readonly growerId?: string;
}) {
  const { t } = await getTranslation();
  const shown = limit ? comments.slice(-limit) : comments;
  const titleId = `${sectionId}-title`;
  const conversation = variant === "conversation";
  return (
    <section id={sectionId} aria-labelledby={titleId} className="flex flex-col gap-3 scroll-mt-20">
      <h2 id={titleId} className="sr-only">
        {t("publication.comments.title")}
      </h2>
      {comments.length === 0 ? (
        <p className="text-base text-text-muted">{t("publication.comments.none")}</p>
      ) : (
        <ul className={conversation ? "flex flex-col gap-5" : "flex flex-col gap-4"}>
          {shown.map((comment) => (
            <CommentItem
              key={comment.id}
              updateId={updateId}
              node={comment}
              canPost={canPost}
              canReport={canReport}
              depth={0}
              conversation={conversation}
              growerId={growerId}
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
  conversation,
  growerId,
}: {
  readonly updateId: string;
  readonly node: CommentNode;
  readonly canPost: boolean;
  readonly canReport: boolean;
  readonly depth: number;
  readonly conversation: boolean;
  readonly growerId?: string;
}) {
  const { t, locale } = await getTranslation();
  const name = displayedName(node.authorName, t("privacy.formerGrower"));
  const isGrower = conversation && growerId !== undefined && node.authorId === growerId;
  const byline = conversation ? (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-semibold text-text">{name}</span>
      {isGrower ? (
        <span className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">
          {t("publication.comments.growerTag")}
        </span>
      ) : null}
      <span className="text-[13px] text-text-muted">
        {formatDate(node.createdAt, locale)}
        {node.editedAt ? ` · ${t("publication.comments.edited")}` : null}
      </span>
    </p>
  ) : (
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
    <ul className={conversation ? "mt-3 flex flex-col gap-4" : "mt-2 flex flex-col gap-4"}>
      {node.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          updateId={updateId}
          node={reply}
          canPost={canPost}
          canReport={canReport}
          depth={depth + 1}
          conversation={conversation}
          growerId={growerId}
        />
      ))}
    </ul>
  );
  const avatar = conversation ? (
    <InitialsAvatar
      name={name}
      size={depth > 0 ? "sm" : "md"}
      tone={isGrower ? "grower" : "neutral"}
    />
  ) : null;
  const bodyClass = conversation
    ? "mt-1 inline-block max-w-full rounded-[12px] bg-background px-3 py-2 whitespace-pre-line text-base text-text"
    : "whitespace-pre-line text-base text-text";

  return (
    <li className={depth > 0 ? "ml-3 border-l border-border pl-3" : ""}>
      <CommentBranch
        replyCount={replyCount}
        summary={summary}
        replies={replies}
        compact={conversation}
      >
        <article
          aria-label={t("publication.comments.byAuthor", { name })}
          className={conversation ? "flex gap-2.5" : "flex flex-col gap-1"}
        >
          {avatar}
          <div className={conversation ? "flex min-w-0 flex-1 flex-col" : "flex flex-col gap-1"}>
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
                bodyClassName={bodyClass}
              />
            ) : (
              <>
                {byline}
                <p className={bodyClass}>{node.body}</p>
              </>
            )}

            {/* Reply and Report share a line. A disclosure that is open takes the whole line, so its form has room. */}
            <div
              className={
                conversation
                  ? "mt-1 flex flex-wrap items-center gap-x-4 text-[13px]"
                  : "flex flex-wrap items-start gap-x-4"
              }
            >
              {!node.isRemoved && canPost ? (
                <details className="open:basis-full">
                  <summary
                    className={
                      conversation
                        ? "inline-flex min-h-9 cursor-pointer items-center font-semibold text-text-muted hover:text-text-brand"
                        : "inline-flex min-h-11 min-w-11 cursor-pointer items-center text-base font-medium text-text-brand"
                    }
                  >
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
          </div>
        </article>
      </CommentBranch>
    </li>
  );
}
