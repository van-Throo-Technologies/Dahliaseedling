import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { PUBLIC_URL_SECONDS } from "./limits";

/*
 * Public community data access. Reads run with the reader's own session, so the database decides what is
 * public: the Feed, a seedling's journey, an Update and its comments are all filtered by the same helpers
 * the write paths use. Storage paths are read here, on the server, and turned into short-lived signed URLs.
 * A Storage path is never placed in a client component's props.
 */

export type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface PublicImage {
  readonly id: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

export interface UpdateSummary {
  readonly updateId: string;
  readonly seedlingId: string;
  readonly seedlingName: string | null;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorHasAvatar: boolean;
  readonly caption: string | null;
  readonly observedAt: string;
  readonly publishedAt: string;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly likedByMe: boolean;
  readonly images: readonly PublicImage[];
}

export interface CommentNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly isRemoved: boolean;
  readonly isMine: boolean;
  readonly replies: CommentNode[];
}

interface RawMedia {
  readonly id: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
}

interface RawUpdateRow {
  readonly update_id: string;
  readonly seedling_id: string;
  readonly seedling_name: string | null;
  readonly author_id: string;
  readonly author_name: string;
  readonly author_has_avatar: boolean;
  readonly caption: string | null;
  readonly observed_at: string;
  readonly published_at: string;
  readonly like_count: number;
  readonly comment_count: number;
  readonly liked_by_me: boolean;
  readonly media: RawMedia[] | null;
}

/** Turns storage paths into signed URLs, in one request. Images the reader may not see get no URL. */
async function signImages(
  client: Client,
  media: readonly RawMedia[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (media.length === 0) return urls;
  const { data } = await client.storage.from("public-media").createSignedUrls(
    media.map((item) => item.path),
    PUBLIC_URL_SECONDS,
  );
  for (const entry of data ?? []) {
    const item = media.find((candidate) => candidate.path === entry.path);
    if (item && entry.signedUrl) urls.set(item.id, entry.signedUrl);
  }
  return urls;
}

async function toSummaries(
  client: Client,
  rows: readonly RawUpdateRow[],
): Promise<UpdateSummary[]> {
  const allMedia = rows.flatMap((row) => row.media ?? []);
  const urls = await signImages(client, allMedia);
  return rows.map((row) => ({
    updateId: row.update_id,
    seedlingId: row.seedling_id,
    seedlingName: row.seedling_name,
    authorId: row.author_id,
    authorName: row.author_name,
    authorHasAvatar: row.author_has_avatar,
    caption: row.caption,
    observedAt: row.observed_at,
    publishedAt: row.published_at,
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    likedByMe: row.liked_by_me,
    images: (row.media ?? []).flatMap((item) => {
      const url = urls.get(item.id);
      return url ? [{ id: item.id, url, width: item.width, height: item.height }] : [];
    }),
  }));
}

export interface FeedPage {
  readonly items: readonly UpdateSummary[];
  readonly next: { readonly publishedAt: string; readonly id: string } | null;
}

/** One page of the public Feed. Asks for one extra row to learn whether a further page exists. */
export async function listFeedPage(
  client: Client,
  options: {
    readonly limit: number;
    readonly before: { readonly publishedAt: string; readonly id: string } | null;
    readonly followingOnly: boolean;
  },
): Promise<FeedPage> {
  const { data, error } = await client.rpc("list_public_updates", {
    p_limit: options.limit + 1,
    p_before_published: options.before?.publishedAt ?? undefined,
    p_before_id: options.before?.id ?? undefined,
    p_following_only: options.followingOnly,
  });
  if (error) throw new Error("errors.publication.feedFailed");
  const rows = (data ?? []) as unknown as RawUpdateRow[];
  const pageRows = rows.slice(0, options.limit);
  const items = await toSummaries(client, pageRows);
  const last = pageRows.at(-1);
  const hasMore = rows.length > options.limit && last !== undefined;
  return {
    items,
    next: hasMore && last ? { publishedAt: last.published_at, id: last.update_id } : null,
  };
}

/** A seedling's public journey, in the order the observations were made. */
export async function listSeedlingJourney(
  client: Client,
  seedlingId: string,
): Promise<UpdateSummary[]> {
  const { data, error } = await client.rpc("list_canonical_seedling_updates", {
    p_seedling_id: seedlingId,
  });
  if (error) throw new Error("errors.publication.journeyFailed");
  const rows = (data ?? []) as unknown as {
    update_id: string;
    author_id: string;
    author_name: string;
    caption: string | null;
    observed_at: string;
    published_at: string;
    media: RawMedia[] | null;
  }[];
  return toSummaries(
    client,
    rows.map((row) => ({
      update_id: row.update_id,
      seedling_id: seedlingId,
      seedling_name: null,
      author_id: row.author_id,
      author_name: row.author_name,
      author_has_avatar: false,
      caption: row.caption,
      observed_at: row.observed_at,
      published_at: row.published_at,
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
      media: row.media,
    })),
  );
}

/** One public Update, or null when it is missing, deleted, or not public for this reader. */
export async function getPublicUpdate(
  client: Client,
  updateId: string,
): Promise<UpdateSummary | null> {
  const { data, error } = await client.rpc("get_public_update", { p_update_id: updateId });
  if (error) throw new Error("errors.publication.updateFailed");
  const rows = (data ?? []) as unknown as RawUpdateRow[];
  if (rows.length === 0) return null;
  const [summary] = await toSummaries(client, rows);
  return summary ?? null;
}

/** Comments on a public Update, nested one level: replies sit under the comment they answer. */
export async function listComments(client: Client, updateId: string): Promise<CommentNode[]> {
  const { data, error } = await client.rpc("list_update_comments", { p_update_id: updateId });
  if (error) throw new Error("errors.publication.commentsFailed");
  const rows = (data ?? []) as unknown as {
    comment_id: string;
    parent_comment_id: string | null;
    author_id: string;
    author_name: string;
    body: string | null;
    created_at: string;
    edited_at: string | null;
    is_removed: boolean;
    is_mine: boolean;
  }[];
  const nodes = new Map<string, CommentNode>();
  for (const row of rows) {
    nodes.set(row.comment_id, {
      id: row.comment_id,
      parentId: row.parent_comment_id,
      authorId: row.author_id,
      authorName: row.author_name,
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      isRemoved: row.is_removed,
      isMine: row.is_mine,
      replies: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * The cover image of a seedling: its chosen public cover, or the most recently shared public image. Null
 * when the seedling has no public image yet.
 */
export async function seedlingCover(
  client: Client,
  seedlingId: string,
): Promise<PublicImage | null> {
  const { data: derivativeId, error } = await client.rpc("seedling_cover", {
    p_seedling_id: seedlingId,
  });
  if (error || !derivativeId) return null;
  const { data: row } = await client
    .from("public_derivatives")
    .select("id, storage_path, width, height")
    .eq("id", derivativeId)
    .maybeSingle();
  if (!row) return null;
  const urls = await signImages(client, [
    { id: row.id, path: row.storage_path, width: row.width, height: row.height },
  ]);
  const url = urls.get(row.id);
  return url ? { id: row.id, url, width: row.width, height: row.height } : null;
}

export interface SocialState {
  readonly followsSeedling: boolean;
  readonly savedSeedling: boolean;
  readonly followsGrower: boolean;
}

/** The signed-in reader's own follow and save state for one seedling and one grower. */
export async function socialState(
  client: Client,
  readerId: string,
  seedlingId: string,
  growerId: string,
): Promise<SocialState> {
  const [follow, saved, grower] = await Promise.all([
    client
      .from("seedling_follows")
      .select("seedling_id")
      .eq("user_id", readerId)
      .eq("seedling_id", seedlingId)
      .maybeSingle(),
    client
      .from("saved_seedlings")
      .select("seedling_id")
      .eq("user_id", readerId)
      .eq("seedling_id", seedlingId)
      .maybeSingle(),
    client
      .from("grower_follows")
      .select("followed_profile_id")
      .eq("follower_id", readerId)
      .eq("followed_profile_id", growerId)
      .maybeSingle(),
  ]);
  return {
    followsSeedling: Boolean(follow.data),
    savedSeedling: Boolean(saved.data),
    followsGrower: Boolean(grower.data),
  };
}

export interface SeedlingCard {
  readonly id: string;
  readonly workingName: string | null;
  readonly cover: PublicImage | null;
}

/** Public seedlings currently held by a grower. */
export async function listHeldPublicSeedlings(
  client: Client,
  holderId: string,
): Promise<SeedlingCard[]> {
  return seedlingCards(
    client,
    client
      .from("seedlings")
      .select("id, working_name")
      .eq("current_holder_id", holderId)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  );
}

/** Public seedlings originated by a grower, including any that someone else holds now. */
export async function listOriginatedPublicSeedlings(
  client: Client,
  originatorId: string,
): Promise<SeedlingCard[]> {
  return seedlingCards(
    client,
    client
      .from("seedlings")
      .select("id, working_name")
      .eq("originator_id", originatorId)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  );
}

async function seedlingCards(
  client: Client,
  query: PromiseLike<{
    data: { id: string; working_name: string | null }[] | null;
    error: unknown;
  }>,
): Promise<SeedlingCard[]> {
  const { data, error } = await query;
  if (error) throw new Error("errors.publication.seedlingsFailed");
  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      workingName: row.working_name,
      cover: await seedlingCover(client, row.id),
    })),
  );
}

/**
 * Live public Updates by one grower, newest first. The caller already holds the public profile, so the
 * author's name and photo flag are passed in rather than fetched again.
 */
export async function listUpdatesByAuthor(
  client: Client,
  author: { readonly id: string; readonly displayName: string; readonly hasAvatar: boolean },
): Promise<UpdateSummary[]> {
  const { data, error } = await client
    .from("updates")
    .select(
      "id, seedling_id, author_id, caption, observed_at, published_at, update_media(derivative_id, sort_order, public_derivatives(id, storage_path, width, height))",
    )
    .eq("author_id", author.id)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(24);
  if (error) throw new Error("errors.publication.updatesFailed");
  const rows = (data ?? []).map((row) => ({
    update_id: row.id,
    seedling_id: row.seedling_id,
    seedling_name: null,
    author_id: row.author_id,
    author_name: author.displayName,
    author_has_avatar: author.hasAvatar,
    caption: row.caption,
    observed_at: row.observed_at,
    published_at: row.published_at,
    like_count: 0,
    comment_count: 0,
    liked_by_me: false,
    media: (row.update_media ?? [])
      .filter((link) => link.public_derivatives !== null)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => ({
        id: link.public_derivatives!.id,
        path: link.public_derivatives!.storage_path,
        width: link.public_derivatives!.width,
        height: link.public_derivatives!.height,
      })),
  }));
  return toSummaries(client, rows);
}
