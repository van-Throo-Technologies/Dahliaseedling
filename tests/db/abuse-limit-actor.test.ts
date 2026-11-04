import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Phase 10A security regression for the rate limiter's actor identity. Each limited action takes its actor from the caller's session
 * inside a SECURITY DEFINER function, never from a parameter. These tests prove that a grower cannot spend another grower's quota, cannot
 * substitute an actor, cannot write the tables directly, and that a visitor consumes nothing. They also cover refusals and retries.
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let update = "";
let publicSeedling = "";
let rehomeCase = "";
let seedOffer = "";
let conversation = "";

type Action = {
  name: string;
  counter: string;
  call: (
    client: TestUser["client"],
  ) => Promise<{ error: { code?: string; message?: string } | null }>;
  table: string;
  tableRow: () => Record<string, unknown>;
};

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function hits(user: string, action: string): Promise<number> {
  const [row] = await rows(
    "select coalesce(sum(hits), 0)::int as n from public.rate_counters where user_id = $1 and action = $2",
    [user, action],
  );
  return row.n as number;
}

async function rowCount(table: string, actorColumn: string, actor: string): Promise<number> {
  const [row] = await rows(
    `select count(*)::int as n from public.${table} where ${actorColumn} = $1`,
    [actor],
  );
  return row.n as number;
}

function actions(): Action[] {
  return [
    {
      name: "comment",
      counter: "comment",
      table: "comments",
      call: async (client) =>
        await client.rpc("add_comment", { p_update_id: update, p_body: "Lovely" }),
      tableRow: () => ({ update_id: update, body: "Direct" }),
    },
    {
      name: "message",
      counter: "message",
      table: "messages",
      call: async (client) =>
        await client.rpc("send_message", {
          p_conversation_id: conversation,
          p_client_key: crypto.randomUUID(),
          p_body: "Hello",
          p_photo_media_id: null,
        }),
      tableRow: () => ({ conversation_id: conversation, body: "Direct" }),
    },
    {
      name: "report",
      counter: "report",
      table: "reports",
      call: async (client) =>
        await client.rpc("create_report", {
          p_target_type: "update",
          p_target_id: update,
          p_reason: "spam",
        }),
      tableRow: () => ({ target_type: "update", target_id: update, reason: "spam" }),
    },
    {
      name: "rehome interest",
      counter: "rehome_interest",
      table: "rehome_interests",
      call: async (client) =>
        await client.rpc("express_rehome_interest", { p_case_id: rehomeCase }),
      tableRow: () => ({ rehome_case_id: rehomeCase }),
    },
    {
      name: "seed offer interest",
      counter: "seed_offer_interest",
      table: "seed_offer_interests",
      call: async (client) =>
        await client.rpc("express_seed_offer_interest", {
          p_offer_id: seedOffer,
          p_requested_quantity: "a few",
        }),
      tableRow: () => ({ seed_offer_id: seedOffer }),
    },
    {
      name: "availability subscription",
      counter: "availability_subscription",
      table: "availability_subscriptions",
      call: async (client) =>
        await client.rpc("subscribe_availability", {
          p_seedling_id: publicSeedling,
          p_locale: "en",
        }),
      tableRow: () => ({ seedling_id: publicSeedling, locale: "en" }),
    },
  ];
}

beforeAll(async () => {
  alice = await createTestUser("al-alice");
  bob = await createTestUser("al-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: "Alice AL", country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: "Bob AL", country_code: "BE" });

  publicSeedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Actor fixture",
      p_visibility: "public",
    })
  ).data!.id as string;
  update = (await publishPublicImage(alice, await capturePhoto(alice, publicSeedling))).updateId;

  const started = await alice.client.rpc("start_rehome", {
    p_seedling_id: publicSeedling,
    p_term: "donate",
    p_handover: "pickup",
  });
  if (started.error) throw new Error(started.error.message);
  rehomeCase = started.data as string;

  const conv = await alice.client.rpc("start_direct_conversation", { p_other: bob.id });
  if (conv.error) throw new Error(conv.error.message);
  conversation = conv.data as string;

  const source = await alice.client.rpc("create_seed_source", {
    p_kind: "seedling",
    p_seedling_id: publicSeedling,
  });
  if (source.error) throw new Error(source.error.message);
  const offer = await alice.client.rpc("publish_seed_offer", {
    p_source_id: source.data as string,
    p_material_type: "seedheads",
    p_seedhead_count: 2,
    p_mode: "free",
    p_handover_method: "pickup",
    p_items: [],
  });
  if (offer.error) throw new Error(offer.error.message);
  seedOffer = offer.data as string;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the quota is charged to the caller who made the request", () => {
  it.each(actions().map((a) => [a.name, a] as const))(
    "%s: a grower's call is counted to that grower only",
    async (_name, action) => {
      const bobBefore = await hits(bob.id, action.counter);
      const aliceBefore = await hits(alice.id, action.counter);
      const result = await action.call(bob.client);
      expect(result.error, `${action.name} should succeed for its author`).toBeNull();
      expect(await hits(bob.id, action.counter)).toBe(bobBefore + 1);
      expect(await hits(alice.id, action.counter)).toBe(aliceBefore);
    },
  );
});

describe("a grower cannot spend another grower's quota", () => {
  it("exhausting one grower's comment quota leaves another grower unaffected", async () => {
    await withSuperuser((db) =>
      db.query(
        `insert into public.rate_counters (user_id, action, window_start, hits)
         values ($1, 'comment', date_trunc('hour', now()), 60)
         on conflict (user_id, action, window_start) do update set hits = 60`,
        [bob.id],
      ),
    );
    const refused = await bob.client.rpc("add_comment", {
      p_update_id: update,
      p_body: "Over the limit",
    });
    expect(errorCode(refused.error)).toBe("53400");
    const allowed = await alice.client.rpc("add_comment", {
      p_update_id: update,
      p_body: "Still allowed",
    });
    expect(allowed.error).toBeNull();
    expect(await hits(bob.id, "comment")).toBe(60);
  });
});

describe("substitution and direct writes cannot change the actor", () => {
  it.each(actions().map((a) => [a.name, a] as const))(
    "%s: an actor parameter is not accepted",
    async (_name, action) => {
      const before = await rowCount(action.table, "1", "1");
      const baseline = await bob.client.rpc("_rate_limit_consume", {});
      expect(baseline.error).not.toBeNull();
      // The RPC has no parameter that names an actor, so a substituted one is refused before any insert.
      const forged = await (action.name === "comment"
        ? bob.client.rpc("add_comment", {
            p_update_id: update,
            p_body: "Forged",
            p_author_id: alice.id,
          } as never)
        : action.name === "message"
          ? bob.client.rpc("send_message", {
              p_conversation_id: conversation,
              p_client_key: crypto.randomUUID(),
              p_body: "Forged",
              p_photo_media_id: null,
              p_sender_id: alice.id,
            } as never)
          : action.name === "report"
            ? bob.client.rpc("create_report", {
                p_target_type: "update",
                p_target_id: update,
                p_reason: "spam",
                p_reporter_id: alice.id,
              } as never)
            : action.name === "rehome interest"
              ? bob.client.rpc("express_rehome_interest", {
                  p_case_id: rehomeCase,
                  p_user_id: alice.id,
                } as never)
              : action.name === "seed offer interest"
                ? bob.client.rpc("express_seed_offer_interest", {
                    p_offer_id: seedOffer,
                    p_interested_user_id: alice.id,
                  } as never)
                : bob.client.rpc("subscribe_availability", {
                    p_seedling_id: publicSeedling,
                    p_locale: "en",
                    p_user_id: alice.id,
                  } as never));
      expect(forged.error?.code).toBe("PGRST202");
      expect(await rowCount(action.table, "1", "1")).toBe(before);
    },
  );

  it.each(actions().map((a) => [a.name, a] as const))(
    "%s: a direct table insert for another grower is refused, and counts nothing",
    async (_name, action) => {
      const aliceBefore = await hits(alice.id, action.counter);
      const bobBefore = await hits(bob.id, action.counter);
      const { error } = await bob.client
        .from(action.table)
        .insert({ ...action.tableRow(), ...actorField(action.table, alice.id) } as never);
      expect(errorCode(error)).toBe("42501");
      expect(await hits(alice.id, action.counter)).toBe(aliceBefore);
      expect(await hits(bob.id, action.counter)).toBe(bobBefore);
    },
  );
});

function actorField(table: string, actor: string): Record<string, string> {
  const column: Record<string, string> = {
    comments: "author_id",
    messages: "sender_id",
    reports: "reporter_id",
    rehome_interests: "interested_user_id",
    seed_offer_interests: "interested_user_id",
    availability_subscriptions: "user_id",
  };
  return { [column[table]!]: actor };
}

describe("a visitor consumes nothing", () => {
  it.each(actions().map((a) => [a.name, a] as const))(
    "%s: an anonymous request is refused and counts nothing for anyone",
    async (_name, action) => {
      const [before] = await rows(
        "select count(*)::int as rows, coalesce(sum(hits), 0)::int as hits from public.rate_counters",
      );
      const result = await action.call(visitor as unknown as TestUser["client"]);
      expect(errorCode(result.error)).toBe("42501");
      const [after] = await rows(
        "select count(*)::int as rows, coalesce(sum(hits), 0)::int as hits from public.rate_counters",
      );
      expect(after).toEqual(before);
    },
  );
});

describe("a refusal leaves no counter change and no domain write", () => {
  it("a refused report is not counted and creates no report", async () => {
    const reporter = await createTestUser("al-reporter");
    created.push(reporter.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Reporter AL', 'NL')",
        [reporter.id],
      ),
    );
    await withSuperuser((db) =>
      db.query(
        `insert into public.rate_counters (user_id, action, window_start, hits)
         values ($1, 'report', date_trunc('day', now()), 20)`,
        [reporter.id],
      ),
    );
    const refused = await reporter.client.rpc("create_report", {
      p_target_type: "update",
      p_target_id: update,
      p_reason: "spam",
    });
    expect(errorCode(refused.error)).toBe("53400");
    expect(await hits(reporter.id, "report")).toBe(20);
    expect(await rowCount("reports", "reporter_id", reporter.id)).toBe(0);
  });
});

describe("a duplicate retry is counted as an attempt, and stores one row", () => {
  it("a second express_rehome_interest uses one more attempt and does not add a second interest", async () => {
    const interested = await createTestUser("al-interested");
    created.push(interested.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Interested AL', 'NL')",
        [interested.id],
      ),
    );
    const first = await interested.client.rpc("express_rehome_interest", { p_case_id: rehomeCase });
    expect(first.error).toBeNull();
    const second = await interested.client.rpc("express_rehome_interest", {
      p_case_id: rehomeCase,
    });
    expect(second.error).toBeNull();
    expect(await hits(interested.id, "rehome_interest")).toBe(2);
    const stored = await rows(
      "select count(*)::int as n from public.rehome_interests where rehome_case_id = $1 and interested_user_id = $2 and withdrawn_at is null",
      [rehomeCase, interested.id],
    );
    expect(stored[0].n).toBe(1);
  });
});

describe("a write rejected after the counter trigger leaves no count", () => {
  it("a comment whose parent does not exist is refused, and charges nothing", async () => {
    const before = await hits(bob.id, "comment");
    const bad = await bob.client.rpc("add_comment", {
      p_update_id: update,
      p_body: "Orphan reply",
      p_parent_comment_id: "00000000-0000-4000-8000-00000000beef",
    });
    expect(bad.error).not.toBeNull();
    expect(await hits(bob.id, "comment")).toBe(before);
  });
});

describe("counter cleanup cannot remove a live window", () => {
  it("cleanup deletes only counters older than two days, never the current window", async () => {
    const victim = await createTestUser("al-cleanup");
    created.push(victim.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Cleanup AL', 'NL')",
        [victim.id],
      ),
    );
    await withSuperuser((db) =>
      db.query(
        `insert into public.rate_counters (user_id, action, window_start, hits) values
           ($1, 'comment', date_trunc('hour', now()), 7),
           ($1, 'message', now() - interval '3 days', 9)`,
        [victim.id],
      ),
    );
    expect(await consumeOne(victim.id)).toBeNull();
    expect(await hits(victim.id, "comment")).toBe(8);
    const expired = await rows(
      "select count(*)::int as n from public.rate_counters where user_id = $1 and action = 'message'",
      [victim.id],
    );
    expect(expired[0].n).toBe(0);
  });
});

async function consumeOne(user: string): Promise<string | null> {
  try {
    await withSuperuser((db) =>
      db.query("select public._rate_limit_consume('comment', $1)", [user]),
    );
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}
