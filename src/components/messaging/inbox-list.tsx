import Link from "next/link";
import { formatDateTime } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import type { InboxRow } from "@/modules/messaging/repository";

/*
 * The Inbox. Each conversation names what it is about, so a grower can tell a continuation thread from a seed-offer thread.
 * A name the caller cannot read is replaced by the neutral "not available" wording, never by a guess.
 */

const CONTEXT_KEY = {
  direct: { key: "messaging.inbox.contextDirect", named: false },
  seedling: { key: "messaging.inbox.contextSeedling", named: true },
  rehome_case: { key: "messaging.inbox.contextRehome", named: true },
  seed_offer: { key: "messaging.inbox.contextSeedOffer", named: true },
} as const;

export async function InboxList({ rows }: { readonly rows: readonly InboxRow[] }) {
  const { t, locale } = await getTranslation();
  return (
    <ul className="divide-y divide-border rounded-control border border-border bg-surface">
      {rows.map((row) => {
        const context = CONTEXT_KEY[row.context];
        const contextLine = context.named
          ? row.contextName
            ? t(context.key, { name: row.contextName })
            : t("messaging.inbox.contextUnavailable")
          : t(context.key);
        return (
          <li key={row.id}>
            <Link
              href={`/inbox/${row.id}`}
              className="flex min-h-11 flex-col gap-1 px-4 py-3 text-text no-underline hover:bg-background"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium text-text">
                  {row.otherName
                    ? t("messaging.inbox.withGrower", { name: row.otherName })
                    : t("messaging.inbox.unavailableGrower")}
                </span>
                {row.unread ? (
                  <span className="rounded-control bg-primary px-2 py-0.5 text-sm font-medium text-on-primary">
                    {t("messaging.inbox.unread")}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-text-muted">{contextLine}</span>
              {row.lastMessageAt ? (
                <time dateTime={row.lastMessageAt} className="text-sm text-text-muted">
                  {formatDateTime(row.lastMessageAt, locale)}
                </time>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
