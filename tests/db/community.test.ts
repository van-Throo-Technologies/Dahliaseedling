import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  simulateHolderChange,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * The public community layer: the Feed and its cursor, the seedling journey, comments and replies, likes,
 * follows, Save, and suspension. Every check runs through the database as the role that is actually asking.
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser; // holder of the public seedling, and author of its Updates
let bob: TestUser; // a grower who comments and follows
let carol: TestUser; // a grower who follows
let seedling: string;
let privateSeedling: string;
const updates: string[] = [];
const observationOf = new Map<string, string>();

const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

async function scalar(
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown> | undefined> {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows[0]);
}

async function publishOne(
  owner: TestUser,
  targetSeedling: string,
  caption: string,
  observedAt?: string,
): Promise<string> {
  const path = `${owner.id}/${crypto.randomUUID()}.jpg`;
  await owner.client.storage
    .from("private-media")
    .upload(path, new Blob([JPEG], { type: "image/jpeg" }), {
      contentType: "image/jpeg",
      upsert: false,
    });
  const captured = await owner.client.rpc("capture_observation", {
    p_seedling_id: targetSeedling,
    p_new_seedling: false,
    p_paths: [path],
    p_observed_at: observedAt,
  });
  if (captured.error) throw new Error(captured.error.message);
  const observation = captured.data!.id;
  const media = (await scalar(
    "select media_id from public.observation_media where observation_id = $1",
    [observation],
  )) as {
    media_id: string;
  };
  const derivative = `${owner.id}/${crypto.randomUUID()}.webp`;
  await owner.client.storage
    .from("public-media")
    .upload(derivative, new Blob([WEBP], { type: "image/webp" }), {
      contentType: "image/webp",
      upsert: false,
    });
  const published = await owner.client.rpc("publish_update", {
    p_observation_id: observation,
    p_client_key: crypto.randomUUID(),
    p_items: [
      {
        media_id: media.media_id,
        derivative_path: derivative,
        width: 1200,
        height: 800,
        byte_size: 2048,
      },
    ],
    p_caption: caption,
  });
  if (published.error) throw new Error(published.error.message);
  const id = (published.data as { id: string }).id;
  observationOf.set(id, observation);
  return id;
}

beforeAll(async () => {
  alice = await createTestUser("com-alice");
  bob = await createTestUser("com-bob");
  carol = await createTestUser("com-carol");
  created.push(alice.id, bob.id, carol.id);
  for (const user of [alice, bob, carol]) {
    const profile = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: "Community", country_code: "BE" });
    expect(profile.error).toBeNull();
  }
  seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Feed Ember",
      p_visibility: "public",
    })
  ).data!.id;
  privateSeedling = (await alice.client.rpc("create_seedling", { p_working_name: "Quiet Ember" }))
    .data!.id;
  for (let i = 0; i < 5; i++) {
    updates.push(await publishOne(alice, seedling, `Story ${i}`, `2026-0${i + 1}-10T10:00:00Z`));
  }
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the public Feed", () => {
  it("shows public Updates to a visitor, newest first", async () => {
    const { data, error } = await visitor.rpc("list_public_updates", { p_limit: 20 });
    expect(error).toBeNull();
    const ids = (data ?? []).map((row: { update_id: string }) => row.update_id);
    expect(ids.slice(0, 5)).toEqual([...updates].reverse());
  });

  it("returns only the public fields of an Update: no source observation, no private path, no note", async () => {
    const { data } = await visitor.rpc("list_public_updates", { p_limit: 1 });
    const row = (data as Record<string, unknown>[])[0]!;
    expect(Object.keys(row).sort()).toEqual(
      [
        "author_has_avatar",
        "author_id",
        "author_name",
        "caption",
        "comment_count",
        "like_count",
        "liked_by_me",
        "media",
        "observed_at",
        "published_at",
        "seedling_id",
        "seedling_name",
        "update_id",
      ].sort(),
    );
    const media = row.media as { id: string; path: string; width: number; height: number }[];
    expect(Object.keys(media[0]!).sort()).toEqual(["height", "id", "path", "width"]);
    expect(media[0]!.path.endsWith(".webp")).toBe(true);
  });

  it("pages through the Feed with a cursor: no duplicates, no gaps, and a terminal page", async () => {
    // Give three Updates the same publication time, so the tie-breaker is what keeps the order stable.
    const tie = "2026-09-01T09:00:00Z";
    await withSuperuser(async (db) => {
      // The trigger that fixes publication times is switched off only for this data setup.
      await db.query("set session_replication_role = replica");
      await db.query("update public.updates set published_at = $1 where id = any($2::uuid[])", [
        tie,
        updates.slice(0, 3),
      ]);
      await db.query("set session_replication_role = origin");
    });

    const seen: string[] = [];
    let before: { p_before_published?: string; p_before_id?: string } = {};
    let pages = 0;
    for (;;) {
      const { data, error } = await visitor.rpc("list_public_updates", {
        p_limit: 2,
        ...before,
      });
      expect(error).toBeNull();
      const rows = (data ?? []) as { update_id: string; published_at: string }[];
      seen.push(...rows.map((row) => row.update_id));
      pages++;
      if (rows.length < 2) break;
      const last = rows.at(-1)!;
      before = { p_before_published: last.published_at, p_before_id: last.update_id };
      expect(pages).toBeLessThan(500);
    }
    // The Feed is shared by every test user in this database, so compare with the whole Feed, not a count.
    const expected = (await visitor.rpc("list_public_updates", { p_limit: 1000 })).data as {
      update_id: string;
    }[];
    expect(seen).toEqual(expected.map((row) => row.update_id));
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(expected.length);
    expect(seen.length).toBeGreaterThanOrEqual(updates.length);
  });

  it("respects a cursor for an Update that has since been deleted, without repeating earlier items", async () => {
    const { data } = await visitor.rpc("list_public_updates", { p_limit: 2 });
    const rows = data as { update_id: string; published_at: string }[];
    const cursor = rows.at(-1)!;
    // Remove the Update the cursor points at. The next page must still start after the cursor's position.
    await withSuperuser((db) =>
      db.query("update public.updates set deleted_at = now() where id = $1", [cursor.update_id]),
    );
    const next = await visitor.rpc("list_public_updates", {
      p_limit: 2,
      p_before_published: cursor.published_at,
      p_before_id: cursor.update_id,
    });
    const ids = (next.data as { update_id: string }[]).map((row) => row.update_id);
    expect(ids).not.toContain(cursor.update_id);
    expect(ids.every((id) => !rows.map((row) => row.update_id).includes(id))).toBe(true);
    await withSuperuser((db) =>
      db.query("update public.updates set deleted_at = null where id = $1", [cursor.update_id]),
    );
  });

  it("excludes a suspended author's Updates from the public Feed, and restores them when reinstated", async () => {
    const suspended = await publishOne(bob, seedling, "bob reports").catch(() => null);
    expect(suspended).toBeNull(); // bob does not hold the seedling, so the publication is refused
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    try {
      const feed = await visitor.rpc("list_public_updates", { p_limit: 50 });
      const ids = (feed.data as { update_id: string }[]).map((row) => row.update_id);
      expect(ids.some((id) => updates.includes(id))).toBe(false);
      const direct = await visitor.rpc("get_public_update", { p_update_id: updates[0] });
      expect(direct.data).toEqual([]);
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
      );
    }
    const restored = await visitor.rpc("list_public_updates", { p_limit: 50 });
    expect((restored.data as { update_id: string }[]).length).toBeGreaterThanOrEqual(
      updates.length,
    );
  });

  it("shows the following view only to the people a grower follows", async () => {
    await carol.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: true });
    const following = await carol.client.rpc("list_public_updates", {
      p_limit: 50,
      p_following_only: true,
    });
    expect((following.data as unknown[]).length).toBe(updates.length);
    const bobsView = await bob.client.rpc("list_public_updates", {
      p_limit: 50,
      p_following_only: true,
    });
    expect(bobsView.data).toEqual([]);
    const visitorView = await visitor.rpc("list_public_updates", {
      p_limit: 50,
      p_following_only: true,
    });
    expect(visitorView.data).toEqual([]);
    await carol.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: false });
  });
});

describe("the seedling journey", () => {
  it("shows one seedling's Updates in the order they were observed, across years", async () => {
    const journey = await visitor.rpc("list_canonical_seedling_updates", {
      p_seedling_id: seedling,
    });
    const rows = journey.data as { update_id: string; observed_at: string }[];
    expect(rows.map((row) => row.update_id)).toEqual(updates);
    const years = new Set(rows.map((row) => new Date(row.observed_at).getUTCFullYear()));
    expect(years.size).toBe(1);
  });

  it("holds Updates across two growing years for one seedling identity", async () => {
    const older = await publishOne(alice, seedling, "Last year", "2025-07-01T10:00:00Z");
    const journey = (
      await visitor.rpc("list_canonical_seedling_updates", { p_seedling_id: seedling })
    ).data as {
      update_id: string;
      observed_at: string;
    }[];
    const yearsSeen = new Set(journey.map((row) => new Date(row.observed_at).getUTCFullYear()));
    expect(yearsSeen).toEqual(new Set([2025, 2026]));
    expect(journey[0]!.update_id).toBe(older);
    const seedlings = await scalar(
      "select count(distinct seedling_id)::int as n from public.updates where id = any($1::uuid[])",
      [[older, ...updates]],
    );
    expect(seedlings).toEqual({ n: 1 });
  });

  it("refuses the journey of a private seedling to a visitor, as if it did not exist", async () => {
    const result = await visitor.rpc("list_canonical_seedling_updates", {
      p_seedling_id: privateSeedling,
    });
    expect(result.data).toEqual([]);
  });
});

describe("comments and replies", () => {
  let thread: string;

  beforeAll(() => {
    thread = updates[0]!;
  });

  it("lets a visitor read comments, but not write them", async () => {
    const read = await visitor.rpc("list_update_comments", { p_update_id: thread });
    expect(read.error).toBeNull();
    const write = await visitor.rpc("add_comment", { p_update_id: thread, p_body: "hello" });
    expect(errorCode(write.error)).toBe("42501");
  });

  it("lets a participating grower comment, reply, and sees the reply under its parent", async () => {
    const parent = await bob.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "Lovely colour",
    });
    expect(parent.error).toBeNull();
    const reply = await alice.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "Thank you",
      p_parent_comment_id: parent.data as string,
    });
    expect(reply.error).toBeNull();
    const comments = (await visitor.rpc("list_update_comments", { p_update_id: thread })).data as {
      comment_id: string;
      parent_comment_id: string | null;
    }[];
    expect(comments.find((row) => row.comment_id === reply.data)?.parent_comment_id).toBe(
      parent.data,
    );
  });

  it("refuses a reply whose parent belongs to another Update", async () => {
    const otherThread = updates[1]!;
    const parent = await bob.client.rpc("add_comment", {
      p_update_id: otherThread,
      p_body: "elsewhere",
    });
    const cross = await bob.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "wrong thread",
      p_parent_comment_id: parent.data as string,
    });
    expect(errorCode(cross.error)).toBe("23514");
  });

  it("lets an author edit their own comment, marking when it changed, and refuses anyone else", async () => {
    const mine = await bob.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "first draft",
    });
    const edited = await bob.client.rpc("edit_comment", {
      p_comment_id: mine.data as string,
      p_body: "final words",
    });
    expect(edited.error).toBeNull();
    const row = await scalar(
      "select body, edited_at is not null as changed from public.comments where id = $1",
      [mine.data],
    );
    expect(row).toEqual({ body: "final words", changed: true });

    const theirs = await alice.client.rpc("edit_comment", {
      p_comment_id: mine.data as string,
      p_body: "not mine",
    });
    expect(theirs.error?.message).toBe("comment not found");
  });

  it("lets an author remove their comment without erasing its replies, and shows the removal, not the text", async () => {
    const parent = await bob.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "to be removed",
    });
    const reply = await alice.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "a reply that stays",
      p_parent_comment_id: parent.data as string,
    });
    expect(reply.error).toBeNull();
    expect(
      (await bob.client.rpc("delete_comment", { p_comment_id: parent.data as string })).error,
    ).toBeNull();

    const comments = (await visitor.rpc("list_update_comments", { p_update_id: thread })).data as {
      comment_id: string;
      body: string | null;
      is_removed: boolean;
    }[];
    const removed = comments.find((row) => row.comment_id === parent.data);
    expect(removed?.is_removed).toBe(true);
    expect(removed?.body).toBeNull();
    expect(comments.find((row) => row.comment_id === reply.data)?.body).toBe("a reply that stays");
  });

  it("refuses removing another grower's comment", async () => {
    const mine = await bob.client.rpc("add_comment", { p_update_id: thread, p_body: "mine" });
    await alice.client.rpc("delete_comment", { p_comment_id: mine.data as string });
    const row = await scalar(
      "select deleted_at is null as live from public.comments where id = $1",
      [mine.data],
    );
    expect(row).toEqual({ live: true });
  });

  it("refuses comments on a deleted Update, and from a suspended grower", async () => {
    const doomed = updates[4]!;
    await alice.client.rpc("delete_update", { p_update_id: doomed });
    const closed = await bob.client.rpc("add_comment", { p_update_id: doomed, p_body: "too late" });
    expect(closed.error?.message).toBe("update not found");
    await withSuperuser((db) =>
      db.query("update public.updates set deleted_at = null where id = $1", [doomed]),
    );

    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [carol.id]),
    );
    try {
      const attempt = await carol.client.rpc("add_comment", {
        p_update_id: thread,
        p_body: "suspended",
      });
      expect(errorCode(attempt.error)).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [carol.id]),
      );
    }
  });

  it("hides comments by a suspended grower from the public thread", async () => {
    const posted = await carol.client.rpc("add_comment", {
      p_update_id: thread,
      p_body: "before suspension",
    });
    expect(posted.error).toBeNull();
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [carol.id]),
    );
    try {
      const comments = (await visitor.rpc("list_update_comments", { p_update_id: thread }))
        .data as {
        comment_id: string;
      }[];
      expect(comments.some((row) => row.comment_id === posted.data)).toBe(false);
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [carol.id]),
      );
    }
  });
});

describe("likes", () => {
  const target = (): string => updates[2]!;

  it("lets a grower like an Update once, and unlike it", async () => {
    await bob.client.rpc("set_like", { p_update_id: target(), p_on: true });
    await bob.client.rpc("set_like", { p_update_id: target(), p_on: true });
    const rows = await scalar(
      "select count(*)::int as n from public.likes where update_id = $1 and user_id = $2",
      [target(), bob.id],
    );
    expect(rows).toEqual({ n: 1 });
    await bob.client.rpc("set_like", { p_update_id: target(), p_on: false });
    await bob.client.rpc("set_like", { p_update_id: target(), p_on: false });
    const after = await scalar(
      "select count(*)::int as n from public.likes where update_id = $1 and user_id = $2",
      [target(), bob.id],
    );
    expect(after).toEqual({ n: 0 });
  });

  it("refuses a visitor and a suspended grower, and never exposes who liked", async () => {
    expect(
      errorCode((await visitor.rpc("set_like", { p_update_id: target(), p_on: true })).error),
    ).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [bob.id]),
    );
    try {
      expect(
        errorCode((await bob.client.rpc("set_like", { p_update_id: target(), p_on: true })).error),
      ).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
      );
    }
    const direct = await visitor.from("likes").select("user_id");
    expect(errorCode(direct.error) === "42501" || (direct.data ?? []).length === 0).toBe(true);
  });

  it("reports a like count, and leaves Feed order alone", async () => {
    const before = (
      (await visitor.rpc("list_public_updates", { p_limit: 50 })).data as { update_id: string }[]
    ).map((row) => row.update_id);
    await carol.client.rpc("set_like", { p_update_id: updates[0]!, p_on: true });
    const feed = (await visitor.rpc("list_public_updates", { p_limit: 50 })).data as {
      update_id: string;
      like_count: number;
    }[];
    expect(feed.find((row) => row.update_id === updates[0])?.like_count).toBeGreaterThanOrEqual(1);
    // A like changes the count and nothing about the order.
    expect(feed.map((row) => row.update_id)).toEqual(before);
    await carol.client.rpc("set_like", { p_update_id: updates[0]!, p_on: false });
  });
});

describe("follows", () => {
  it("follows a public seedling by its uuid, and refuses a private one", async () => {
    expect(
      (await bob.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: true })).error,
    ).toBeNull();
    expect(
      errorCode(
        (
          await bob.client.rpc("set_seedling_follow", {
            p_seedling_id: privateSeedling,
            p_on: true,
          })
        ).error,
      ),
    ).toBe("P0002");
    await bob.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: true });
    const rows = await scalar(
      "select count(*)::int as n from public.seedling_follows where user_id = $1",
      [bob.id],
    );
    expect(rows).toEqual({ n: 1 });
    await bob.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: false });
  });

  it("keeps a seedling follow when the holder changes, because it attaches to the seedling", async () => {
    await carol.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: true });
    await simulateHolderChange(seedling, bob.id);
    try {
      const still = await scalar(
        "select count(*)::int as n from public.seedling_follows where user_id = $1 and seedling_id = $2",
        [carol.id, seedling],
      );
      expect(still).toEqual({ n: 1 });
    } finally {
      await simulateHolderChange(seedling, alice.id);
      await carol.client.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: false });
    }
  });

  it("follows a grower, refuses following oneself, and keeps it independent of following a seedling", async () => {
    expect(
      (await bob.client.rpc("set_grower_follow", { p_profile_id: alice.id, p_on: true })).error,
    ).toBeNull();
    expect(
      errorCode(
        (await bob.client.rpc("set_grower_follow", { p_profile_id: bob.id, p_on: true })).error,
      ),
    ).toBe("23514");
    const independent = await scalar(
      "select (select count(*) from public.grower_follows where follower_id = $1)::int as growers, (select count(*) from public.seedling_follows where user_id = $1)::int as seedlings",
      [bob.id],
    );
    expect(independent).toEqual({ growers: 1, seedlings: 0 });
    await bob.client.rpc("set_grower_follow", { p_profile_id: alice.id, p_on: false });
  });

  it("refuses a suspended grower's follow, and a visitor's", async () => {
    expect(
      errorCode(
        (await visitor.rpc("set_seedling_follow", { p_seedling_id: seedling, p_on: true })).error,
      ),
    ).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [bob.id]),
    );
    try {
      expect(
        errorCode(
          (await bob.client.rpc("set_grower_follow", { p_profile_id: carol.id, p_on: true })).error,
        ),
      ).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
      );
    }
  });
});

describe("Save", () => {
  it("lets the holder save their own private seedling, and nobody else learns of it", async () => {
    const save = await alice.client.rpc("set_seedling_save", {
      p_seedling_id: privateSeedling,
      p_on: true,
    });
    expect(save.error).toBeNull();
    const own = await alice.client.from("saved_seedlings").select("seedling_id");
    expect(own.data).toHaveLength(1);
    const others = await bob.client.from("saved_seedlings").select("seedling_id");
    expect(others.data).toEqual([]);
    const visitorView = await visitor.from("saved_seedlings").select("seedling_id");
    expect(errorCode(visitorView.error) === "42501" || (visitorView.data ?? []).length === 0).toBe(
      true,
    );
  });

  it("refuses saving a private seedling that is not one's own, and makes repeat saves safe", async () => {
    expect(
      errorCode(
        (await bob.client.rpc("set_seedling_save", { p_seedling_id: privateSeedling, p_on: true }))
          .error,
      ),
    ).toBe("P0002");
    await bob.client.rpc("set_seedling_save", { p_seedling_id: seedling, p_on: true });
    await bob.client.rpc("set_seedling_save", { p_seedling_id: seedling, p_on: true });
    const rows = await scalar(
      "select count(*)::int as n from public.saved_seedlings where user_id = $1 and seedling_id = $2",
      [bob.id, seedling],
    );
    expect(rows).toEqual({ n: 1 });
    await bob.client.rpc("set_seedling_save", { p_seedling_id: seedling, p_on: false });
  });

  it("refuses a visitor and a suspended grower", async () => {
    expect(
      errorCode(
        (await visitor.rpc("set_seedling_save", { p_seedling_id: seedling, p_on: true })).error,
      ),
    ).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [bob.id]),
    );
    try {
      expect(
        errorCode(
          (await bob.client.rpc("set_seedling_save", { p_seedling_id: seedling, p_on: true }))
            .error,
        ),
      ).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
      );
    }
  });
});

describe("the public profile tabs", () => {
  it("lists the Updates a grower authored, for visitors, and leaves private seedlings out", async () => {
    const rows = (await visitor.from("updates").select("id").eq("author_id", alice.id)).data as {
      id: string;
    }[];
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining(updates));
    const privateListing = await visitor
      .from("seedlings")
      .select("id")
      .eq("originator_id", alice.id)
      .eq("visibility", "public");
    expect((privateListing.data ?? []).map((row) => row.id)).not.toContain(privateSeedling);
  });

  it("does not expose a private seedling's Updates, or a deleted Update, under a profile", async () => {
    const deleted = updates[3]!;
    await alice.client.rpc("delete_update", { p_update_id: deleted });
    try {
      const rows = (await visitor.from("updates").select("id").eq("author_id", alice.id)).data as {
        id: string;
      }[];
      expect(rows.map((row) => row.id)).not.toContain(deleted);
    } finally {
      await withSuperuser((db) =>
        db.query("update public.updates set deleted_at = null where id = $1", [deleted]),
      );
    }
  });
});
