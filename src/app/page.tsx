import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/design-system/components/form-message";
import { UpdateCard } from "@/components/publications/update-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/identity/session";
import { FEED_PAGE_SIZE } from "@/modules/publications/limits";
import { listFeedPage } from "@/modules/publications/repository";
import { encodeCursor, validateFeedCursor } from "@/modules/publications/validation";

export const metadata: Metadata = { title: "Feed" };

/*
 * Home is the public Feed. Visitors can read it without an account. Participation is needed only for the
 * actions on each card. The order is deterministic: newest publication first, with the Update id as the
 * tie-breaker. Older Updates load by cursor, so a new Update never shifts or repeats a page.
 */
export default async function HomePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ view?: string; cursor?: string }>;
}) {
  const query = await searchParams;
  const viewer = await getCurrentUser();
  const followingView = query.view === "following" && viewer !== null;
  const cursor = validateFeedCursor(query.cursor);

  if (!cursor.ok) {
    return (
      <div className="flex flex-col gap-6">
        <FormMessage tone="error">{cursor.message}</FormMessage>
        <Link href="/" className="text-base text-text-brand">
          Back to the Feed
        </Link>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const page = await listFeedPage(supabase, {
    limit: FEED_PAGE_SIZE,
    before: cursor.value,
    followingOnly: followingView,
  });

  const base = followingView ? "/?view=following" : "/";
  const separator = followingView ? "&" : "?";
  const olderHref = page.next
    ? `${base}${separator}cursor=${encodeCursor(page.next.publishedAt, page.next.id)}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl leading-tight text-text-brand">Feed</h1>
        <p className="text-base text-text-muted">
          Stories from growers, shared deliberately. The photo leads, and each one opens its
          seedling.
        </p>
        {viewer ? (
          <nav aria-label="Feed view">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href="/"
                  aria-current={followingView ? undefined : "page"}
                  className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
                >
                  Everyone
                </Link>
              </li>
              <li>
                <Link
                  href="/?view=following"
                  aria-current={followingView ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
                >
                  Following
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      {page.items.length === 0 ? (
        <section
          aria-labelledby="empty-title"
          className="flex flex-col gap-2 rounded-surface border border-border bg-surface p-4"
        >
          <h2 id="empty-title" className="text-lg font-medium text-text">
            {followingView
              ? "Nothing from the people you follow yet"
              : "Nothing has been shared yet"}
          </h2>
          <p className="text-base text-text-muted">
            {followingView
              ? "Follow a seedling or a grower, and their public Updates will collect here."
              : "When a grower shares a photo from one of their seedlings, it appears here."}
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-6">
          {page.items.map((update) => (
            <li key={update.updateId}>
              <UpdateCard update={update} />
            </li>
          ))}
        </ul>
      )}

      {olderHref ? (
        <nav aria-label="Older updates">
          <Link
            href={olderHref}
            className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
          >
            Show older updates
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
