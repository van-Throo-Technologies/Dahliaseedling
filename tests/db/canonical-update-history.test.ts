import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Canonical Update history (Phase 9). The canonical Seedling's page shows the public Updates of the canonical Seedling and of every
 * retired identity folded into it, following chains. Nothing is copied or rewritten: each Update keeps its id, seedling, author and
 * timestamps, and its comments and likes stay attached. Private, moderated and removed Updates stay hidden, and reads write nothing.
 */

const tag = "ch" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const anon = anonClient();
let alice: TestUser;
let bob: TestUser;
let canonical = "";
let chainA = "";
let chainB = "";
let privateSeedling = "";
let uCanonical = "";
let uChainA = "";
let uChainB = "";
let uDeleted = "";
let uModerated = "";
let uPrivate = "";
let commentId = "";

type HistoryRow = {
  update_id: string;
  author_id: string;
  observed_at: string;
  published_at: string;
};

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function seedling(name: string) {
  const { data, error } = await alice.client.rpc("create_seedling", {
    p_working_name: `${name} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

async function publish(seedlingId: string) {
  const photo = await capturePhoto(alice, seedlingId);
  return (await publishPublicImage(alice, photo)).updateId;
}

async function merge(canonicalId: string, duplicateId: string) {
  const { error } = await alice.client.rpc("merge_seedlings", {
    p_canonical: canonicalId,
    p_duplicate: duplicateId,
    p_confirmed: true,
  });
  if (error) throw new Error(`merge failed: ${error.message}`);
}

async function history(client: typeof alice.client, seedlingId: string): Promise<HistoryRow[]> {
  const { data, error } = await client.rpc("list_canonical_seedling_updates", {
    p_seedling_id: seedlingId,
  });
  if (error) throw new Error(error.message);
  return data as HistoryRow[];
}

async function counts() {
  const [row] = await rows(`select
    (select count(*)::int from public.notifications) as notifications,
    (select count(*)::int from public.email_outbox) as outbox,
    (select count(*)::int from public.availability_subscriptions) as availability,
    (select count(*)::int from public.rehome_cases) as cases`);
  return row;
}

beforeAll(async () => {
  alice = await createTestUser("ch-alice");
  bob = await createTestUser("ch-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });

  canonical = await seedling("Canonical");
  chainA = await seedling("ChainA");
  chainB = await seedling("ChainB");
  privateSeedling = await seedling("Private");

  uCanonical = await publish(canonical);
  uChainA = await publish(chainA);
  uChainB = await publish(chainB);
  uDeleted = await publish(chainB);
  uPrivate = await publish(privateSeedling);
  uModerated = await publish(canonical);

  expect((await alice.client.rpc("delete_update", { p_update_id: uDeleted })).error).toBeNull();
  await rows("update public.updates set deleted_at = now() where id = $1", [uModerated]);

  expect((await bob.client.rpc("set_like", { p_update_id: uChainA, p_on: true })).error).toBeNull();
  const comment = await bob.client.rpc("add_comment", { p_update_id: uChainA, p_body: "Lovely" });
  expect(comment.error).toBeNull();
  commentId = comment.data as string;

  // A two-step chain (chainA into chainB, then chainB into canonical), plus a Seedling that becomes private before it is folded in.
  await merge(chainB, chainA);
  await merge(canonical, chainB);
  await rows("update public.seedlings set visibility = 'private' where id = $1", [privateSeedling]);
  await merge(canonical, privateSeedling);
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("canonical Update history", () => {
  it("shows the canonical Seedling's own public Update exactly once", async () => {
    const ids = (await history(alice.client, canonical)).map((r) => r.update_id);
    expect(ids.filter((id) => id === uCanonical)).toHaveLength(1);
  });

  it("shows public Updates from retired duplicates, including those reached through a two-step chain", async () => {
    const ids = (await history(alice.client, canonical)).map((r) => r.update_id);
    expect(ids).toContain(uChainA);
    expect(ids).toContain(uChainB);
  });

  it("keeps each Update's identifier, seedling, author and timestamps unchanged", async () => {
    const [stored] = await rows(
      "select id::text, seedling_id::text, author_id::text, observed_at, published_at from public.updates where id = $1",
      [uChainA],
    );
    expect(stored.seedling_id).toBe(chainA);
    const shown = (await history(alice.client, canonical)).find((r) => r.update_id === uChainA);
    expect(shown?.author_id).toBe(stored.author_id);
    expect(new Date(shown!.observed_at).getTime()).toBe(new Date(stored.observed_at).getTime());
    expect(new Date(shown!.published_at).getTime()).toBe(new Date(stored.published_at).getTime());
  });

  it("keeps comments and likes attached to the retired Update", async () => {
    const { data } = await anon.rpc("list_update_comments", { p_update_id: uChainA });
    expect((data as { comment_id: string }[]).map((c) => c.comment_id)).toContain(commentId);
    const [likes] = await rows(
      "select count(*)::int as n from public.likes where update_id = $1 and user_id = $2",
      [uChainA, bob.id],
    );
    expect(likes.n).toBe(1);
  });

  it("keeps private history private for a visitor and for the holder", async () => {
    const visitor = (await history(anon, canonical)).map((r) => r.update_id);
    const holder = (await history(alice.client, canonical)).map((r) => r.update_id);
    expect(visitor).not.toContain(uPrivate);
    expect(holder).not.toContain(uPrivate);
  });

  it("hides moderated and removed Updates", async () => {
    const ids = (await history(anon, canonical)).map((r) => r.update_id);
    expect(ids).not.toContain(uModerated);
    expect(ids).not.toContain(uDeleted);
  });

  it("returns no duplicate rows", async () => {
    const ids = (await history(anon, canonical)).map((r) => r.update_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns the same public history to a visitor as to the holder", async () => {
    const visitor = (await history(anon, canonical)).map((r) => r.update_id).sort();
    const holder = (await history(alice.client, canonical)).map((r) => r.update_id).sort();
    expect(visitor).toEqual(holder);
  });

  it("orders the history by observed time, then published time, then id", async () => {
    const list = await history(anon, canonical);
    const keys: [number, number][] = list.map((r) => [
      new Date(r.observed_at).getTime(),
      new Date(r.published_at).getTime(),
    ]);
    const sorted = [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(keys).toEqual(sorted);
  });

  it("resolves a retired identity through a multi-level chain to the canonical Seedling", async () => {
    const { data, error } = await anon.rpc("seedling_canonical_id", { p_seedling_id: chainA });
    expect(error).toBeNull();
    expect(data).toBe(canonical);
  });

  it("refuses a write that would close a cycle between merged Seedlings", async () => {
    await expect(
      rows("update public.seedlings set merged_into_id = $1 where id = $2", [chainA, canonical]),
    ).rejects.toThrow();
  });

  it("keeps retired Seedlings out of Search", async () => {
    const { data, error } = await anon.rpc("search_seedlings", {
      p_query: `ChainA ${tag}`,
      p_limit: 20,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { seedling_id: string }) => r.seedling_id);
    expect(ids).not.toContain(chainA);
    expect(ids).not.toContain(chainB);
  });

  it("writes no notification, availability change or outbox email when history is read", async () => {
    const before = await counts();
    await history(anon, canonical);
    await history(alice.client, canonical);
    await anon.rpc("seedling_canonical_id", { p_seedling_id: chainA });
    expect(await counts()).toEqual(before);
  });
});
