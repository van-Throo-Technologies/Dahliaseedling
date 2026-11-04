import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Reads for the Inbox, a conversation and the notification list. Every query runs with the caller's own session, so the
 * row-level policies decide what is visible: a conversation for its two participants, a message for the same two, a
 * notification for its recipient. A name the caller cannot read (for example a suspended grower) is returned as null,
 * and the page shows the neutral "not available" wording instead.
 */

export type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type ContextType = "direct" | "seedling" | "rehome_case" | "seed_offer";

export interface InboxRow {
  readonly id: string;
  readonly context: ContextType;
  readonly otherId: string | null;
  readonly otherName: string | null;
  /** The Seedling's working name, or the seller's name for a seed offer. Null when the context is not visible. */
  readonly contextName: string | null;
  readonly lastMessageAt: string | null;
  readonly unread: boolean;
}

export interface ThreadRow {
  readonly id: string;
  readonly context: ContextType;
  readonly contextName: string | null;
  readonly otherId: string | null;
  readonly otherName: string | null;
  readonly blockedByMe: boolean;
  readonly messages: readonly MessageRow[];
}

export interface MessageRow {
  readonly id: string;
  readonly mine: boolean;
  readonly body: string | null;
  readonly photoId: string | null;
  readonly createdAt: string;
}

export interface NotificationRow {
  readonly id: string;
  readonly type: string;
  readonly actorName: string | null;
  readonly unread: boolean;
  readonly createdAt: string;
  readonly href: string | null;
}

/** Display names for a set of growers. A grower who cannot be read (suspended) has no entry. */
async function namesFor(client: Client, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data } = await client.from("profiles").select("id, display_name").in("id", unique);
  for (const row of data ?? []) names.set(row.id, row.display_name);
  return names;
}

/** Working names for Seedlings, and the seller of each seed offer, for the context line. */
async function contextNames(
  client: Client,
  conversations: readonly {
    readonly seedling_id: string | null;
    readonly rehome_case_id: string | null;
    readonly seed_offer_id: string | null;
  }[],
  caseSeedlings: ReadonlyMap<string, string>,
): Promise<{ seedlings: Map<string, string | null>; sellers: Map<string, string> }> {
  const offerIds = conversations.map((c) => c.seed_offer_id).filter((v): v is string => v !== null);
  const seedlingIds = conversations
    .map((c) => c.seedling_id)
    .filter((v): v is string => v !== null);
  const seedlings = new Map<string, string | null>();
  const sellers = new Map<string, string>();

  const allSeedlings = [...new Set([...seedlingIds, ...caseSeedlings.values()])];
  if (allSeedlings.length > 0) {
    const { data } = await client
      .from("seedlings")
      .select("id, working_name")
      .in("id", allSeedlings);
    for (const row of data ?? []) seedlings.set(row.id, row.working_name);
  }

  const offerSellers = new Map<string, string>();
  if (offerIds.length > 0) {
    const { data } = await client.from("seed_offers").select("id, seller_id").in("id", offerIds);
    for (const row of data ?? []) offerSellers.set(row.id, row.seller_id);
  }
  const sellerNames = await namesFor(client, [...offerSellers.values()]);
  for (const [offer, seller] of offerSellers) {
    const name = sellerNames.get(seller);
    if (name) sellers.set(offer, name);
  }
  return { seedlings, sellers };
}

function contextNameFor(
  conversation: {
    readonly context_type: string;
    readonly seedling_id: string | null;
    readonly rehome_case_id: string | null;
    readonly seed_offer_id: string | null;
  },
  caseSeedlings: Map<string, string>,
  seedlings: Map<string, string | null>,
  sellers: Map<string, string>,
): string | null {
  if (conversation.context_type === "seedling" && conversation.seedling_id) {
    return seedlings.get(conversation.seedling_id) ?? null;
  }
  if (conversation.context_type === "rehome_case" && conversation.rehome_case_id) {
    const seedling = caseSeedlings.get(conversation.rehome_case_id);
    return seedling ? (seedlings.get(seedling) ?? null) : null;
  }
  if (conversation.context_type === "seed_offer" && conversation.seed_offer_id) {
    return sellers.get(conversation.seed_offer_id) ?? null;
  }
  return null;
}

async function caseSeedlingMap(
  client: Client,
  caseIds: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (caseIds.length === 0) return map;
  const { data } = await client.from("rehome_cases").select("id, seedling_id").in("id", caseIds);
  for (const row of data ?? []) map.set(row.id, row.seedling_id);
  return map;
}

/** The Inbox, most recent conversation first. Unread means a newer message from the other participant. */
export async function listInbox(client: Client, userId: string): Promise<InboxRow[]> {
  const { data: conversations, error } = await client
    .from("conversations")
    .select(
      "id, user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id, last_message_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error || !conversations) return [];

  const { data: reads } = await client
    .from("conversation_reads")
    .select("conversation_id, read_at")
    .eq("user_id", userId);
  const readAt = new Map((reads ?? []).map((row) => [row.conversation_id, row.read_at as string]));
  const otherIds = conversations.map((c) => (c.user_a_id === userId ? c.user_b_id : c.user_a_id));
  const names = await namesFor(client, otherIds);
  const caseSeedlings = await caseSeedlingMap(
    client,
    conversations.map((c) => c.rehome_case_id).filter((v): v is string => v !== null),
  );
  const { seedlings, sellers } = await contextNames(client, conversations, caseSeedlings);

  return conversations.map((c) => {
    const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
    const last = c.last_message_at;
    const read = readAt.get(c.id);
    return {
      id: c.id,
      context: c.context_type as ContextType,
      otherId,
      otherName: names.get(otherId) ?? null,
      contextName: contextNameFor(c, caseSeedlings, seedlings, sellers),
      lastMessageAt: last,
      unread: last !== null && (read === undefined || Date.parse(last) > Date.parse(read)),
    };
  });
}

/** One conversation with its messages. Returns null when the caller is not a participant (the same as "not found"). */
export async function loadThread(
  client: Client,
  userId: string,
  conversationId: string,
): Promise<ThreadRow | null> {
  const { data: conversation } = await client
    .from("conversations")
    .select("id, user_a_id, user_b_id, context_type, seedling_id, rehome_case_id, seed_offer_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return null;

  const otherId =
    conversation.user_a_id === userId ? conversation.user_b_id : conversation.user_a_id;
  const names = await namesFor(client, [otherId]);
  const caseSeedlings = await caseSeedlingMap(
    client,
    conversation.rehome_case_id ? [conversation.rehome_case_id] : [],
  );
  const { seedlings, sellers } = await contextNames(client, [conversation], caseSeedlings);

  const { data: block } = await client
    .from("blocks")
    .select("blocked_id")
    .eq("blocked_id", otherId)
    .maybeSingle();

  const { data: messages } = await client
    .from("messages")
    .select("id, sender_id, body, photo_media_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);

  return {
    id: conversation.id,
    context: conversation.context_type as ContextType,
    contextName: contextNameFor(conversation, caseSeedlings, seedlings, sellers),
    otherId,
    otherName: names.get(otherId) ?? null,
    blockedByMe: block !== null,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      mine: m.sender_id === userId,
      body: m.body,
      photoId: m.photo_media_id,
      createdAt: m.created_at,
    })),
  };
}

/** The newest notifications for the caller, with the actor's name where it can be read. */
export async function listNotifications(client: Client): Promise<NotificationRow[]> {
  const { data, error } = await client
    .from("notifications")
    .select("id, type, actor_id, seedling_id, update_id, conversation_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const names = await namesFor(
    client,
    data.map((n) => n.actor_id).filter((v): v is string => v !== null),
  );
  return data.map((n) => ({
    id: n.id,
    type: n.type,
    actorName: n.actor_id ? (names.get(n.actor_id) ?? null) : null,
    unread: n.read_at === null,
    createdAt: n.created_at,
    href: hrefFor(n),
  }));
}

function hrefFor(n: {
  readonly type: string;
  readonly seedling_id: string | null;
  readonly update_id: string | null;
  readonly conversation_id: string | null;
}): string | null {
  if (n.type === "message" && n.conversation_id) return `/inbox/${n.conversation_id}`;
  if (
    (n.type === "comment" || n.type === "reply" || n.type === "followed_seedling_update") &&
    n.update_id
  ) {
    return `/updates/${n.update_id}`;
  }
  if (
    n.seedling_id &&
    [
      "rehome_interest",
      "rehome_selected",
      "rehome_sent",
      "rehome_received",
      "availability_trigger",
    ].includes(n.type)
  ) {
    return `/seedlings/${n.seedling_id}`;
  }
  return null;
}
