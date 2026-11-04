import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { formatDateTime } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import type { ThreadRow } from "@/modules/messaging/repository";
import { sendMessageAction } from "@/modules/messaging/actions";
import { ReportControl } from "@/components/safety/report-control";
import { MESSAGING_ERRORS, MESSAGING_NOTICES } from "./feedback";

/*
 * One conversation: its messages in order, the reader's own messages on the right, and a composer. Each other-grower message
 * has a report control. A blocked grower's history stays readable; the composer is replaced by the plain explanation.
 */

const CONTEXT_KEY = {
  direct: null,
  seedling: "messaging.inbox.contextSeedling",
  rehome_case: "messaging.inbox.contextRehome",
  seed_offer: "messaging.inbox.contextSeedOffer",
} as const;

interface ThreadProps {
  readonly thread: ThreadRow;
  readonly returnTo: string;
  readonly error: string | null;
  readonly notice: string | null;
}

export async function Thread({ thread, returnTo, error, notice }: ThreadProps) {
  const { t, locale } = await getTranslation();
  const name = thread.otherName ?? t("messaging.inbox.unavailableGrower");
  const contextKey = CONTEXT_KEY[thread.context];
  const contextLine =
    contextKey && thread.contextName
      ? t(contextKey, { name: thread.contextName })
      : contextKey
        ? t("messaging.inbox.contextUnavailable")
        : t("messaging.inbox.contextDirect");
  const errorKey = error ? MESSAGING_ERRORS[error] : undefined;
  const noticeKey = notice ? MESSAGING_NOTICES[notice] : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-text-muted">{contextLine}</p>
        <h1 className="text-2xl font-semibold text-text">
          {t("messaging.thread.title", { name })}
        </h1>
      </header>

      {noticeKey ? <FormMessage tone="success">{t(noticeKey)}</FormMessage> : null}
      {errorKey ? <FormMessage tone="error">{t(errorKey)}</FormMessage> : null}

      {thread.messages.length === 0 ? (
        <p className="text-base text-text-muted">{t("messaging.thread.empty")}</p>
      ) : (
        <ol className="space-y-4">
          {thread.messages.map((message) => (
            <li
              key={message.id}
              className={`flex flex-col gap-1 ${message.mine ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] space-y-2 rounded-control px-4 py-3 ${
                  message.mine
                    ? "border border-border bg-background text-text"
                    : "border border-border bg-surface text-text"
                }`}
              >
                {message.body ? (
                  <p className="whitespace-pre-wrap text-base">{message.body}</p>
                ) : null}
                {message.photoId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served by the private media route, which redirects to a short-lived signed URL.
                  <img
                    src={`/media/${message.photoId}`}
                    alt={t("messaging.thread.photoAlt")}
                    loading="lazy"
                    className="max-h-80 w-auto rounded-control"
                  />
                ) : null}
              </div>
              <span className="text-sm text-text-muted">
                {message.mine ? t("messaging.thread.you") : name}
                {" · "}
                <time dateTime={message.createdAt}>
                  {formatDateTime(message.createdAt, locale)}
                </time>
              </span>
              {message.mine ? null : (
                <ReportControl
                  targetType="message"
                  targetId={message.id}
                  returnTo={returnTo}
                  id={`report-${message.id}`}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {thread.blockedByMe ? (
        <p className="text-base text-text-muted">{t("messaging.thread.blockedHistory")}</p>
      ) : (
        <form
          action={sendMessageAction}
          encType="multipart/form-data"
          className="space-y-3 rounded-control border border-border bg-surface p-4"
        >
          <input type="hidden" name="conversationId" value={thread.id} />
          <input type="hidden" name="clientKey" value={crypto.randomUUID()} />
          <div className="space-y-1">
            <label htmlFor="message-body" className="block font-medium text-text">
              {t("messaging.thread.bodyLabel")}
            </label>
            <textarea
              id="message-body"
              name="body"
              rows={3}
              maxLength={2000}
              className="w-full rounded-control border border-border bg-background px-3 py-2 text-base"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="message-photo" className="block font-medium text-text">
              {t("messaging.thread.photoLabel")}
            </label>
            <p id="message-photo-hint" className="text-sm text-text-muted">
              {t("messaging.thread.photoHint")}
            </p>
            <input
              id="message-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="message-photo-hint"
              className="block min-h-11 w-full text-base"
            />
          </div>
          <SubmitButton pendingLabel={t("messaging.thread.send")}>
            {t("messaging.thread.send")}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
