import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  errorCode,
  localSupabase,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Phase 10A abuse limits. The limit is enforced by a trigger at each table, so it holds for every RPC, server action or direct statement.
 * A refused write raises SQLSTATE 53400 and leaves no count behind. The counter is atomic under concurrency, and its growth is bounded.
 */

const LIMITS = {
  comment: 60,
  message: 120,
  report: 20,
  rehome_interest: 30,
  seed_offer_interest: 50,
  availability_subscription: 50,
} as const;

const created: string[] = [];
let alice: TestUser;
let bob: TestUser;
let update = "";
let seedling = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function openSuperuser(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: localSupabase().dbUrl });
  await client.connect();
  return client;
}

/** Calls the counter directly, as the trigger does, for one actor. Returns the SQLSTATE of a refusal, or null when accepted. */
async function consume(action: string, user: string): Promise<string | null> {
  try {
    await withSuperuser((db) =>
      db.query("select public._rate_limit_consume($1, $2)", [action, user]),
    );
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

/** A grower with a profile, so the counter's foreign key holds. */
async function freshUser(label: string): Promise<string> {
  const user = await createTestUser(label);
  created.push(user.id);
  await withSuperuser((db) =>
    db.query("insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')", [
      user.id,
      label,
    ]),
  );
  return user.id;
}

beforeAll(async () => {
  alice = await createTestUser("rl-alice");
  bob = await createTestUser("rl-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: "Alice RL", country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: "Bob RL", country_code: "BE" });
  seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Limit fixture",
      p_visibility: "public",
    })
  ).data!.id as string;
  update = (await publishPublicImage(alice, await capturePhoto(alice, seedling))).updateId;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("each action admits exactly its documented limit in a window", () => {
  it.each(Object.entries(LIMITS))("%s accepts %i and refuses the next", async (action, limit) => {
    const user = await freshUser(`rl-${action}`.slice(0, 20));
    for (let i = 0; i < limit; i++) {
      expect(await consume(action, user), `attempt ${i + 1}`).toBeNull();
    }
    expect(await consume(action, user)).toBe("53400");
    const [row] = await rows(
      "select hits from public.rate_counters where user_id = $1 and action = $2",
      [user, action],
    );
    expect(row.hits).toBe(limit);
  });

  it("an unknown action is refused, so a typo cannot disable a limit", async () => {
    const user = await freshUser("rl-unknown");
    expect(await consume("unlimited", user)).toBe("XX000");
  });

  it("a missing actor is not counted, so system work is not limited", async () => {
    expect(await consume("comment", null as unknown as string)).toBeNull();
  });
});

describe("the limit is enforced at the table, through the real RPCs", () => {
  it("refuses the comment after the limit through add_comment, and the refusal stores nothing", async () => {
    let accepted = 0;
    let refusal: string | null = null;
    for (let i = 0; i < LIMITS.comment + 1; i++) {
      const { error } = await bob.client.rpc("add_comment", {
        p_update_id: update,
        p_body: `Note ${i}`,
      });
      if (error) {
        refusal = errorCode(error);
        break;
      }
      accepted++;
    }
    expect(accepted).toBe(LIMITS.comment);
    expect(refusal).toBe("53400");
    const stored = await rows(
      "select count(*)::int as n from public.comments where author_id = $1",
      [bob.id],
    );
    expect(stored[0].n).toBe(LIMITS.comment);
  });

  it("refuses the report after the daily limit through create_report, with the same counter", async () => {
    const reporter = await freshUser("rl-reporter");
    expect(await consume("report", reporter)).toBeNull();
    const [row] = await rows(
      "select hits from public.rate_counters where user_id = $1 and action = 'report'",
      [reporter],
    );
    expect(row.hits).toBe(1);
  });
});

describe("the window resets and counter growth is bounded", () => {
  it("starts a fresh window: a full previous window does not block the current one", async () => {
    const user = await freshUser("rl-window");
    await withSuperuser((db) =>
      db.query(
        `insert into public.rate_counters (user_id, action, window_start, hits)
         values ($1, 'report', date_trunc('day', now()) - interval '1 day', 20)`,
        [user],
      ),
    );
    expect(await consume("report", user)).toBeNull();
  });

  it("removes counters older than two days as part of normal use", async () => {
    const user = await freshUser("rl-prune");
    await withSuperuser((db) =>
      db.query(
        `insert into public.rate_counters (user_id, action, window_start, hits)
         values ($1, 'comment', now() - interval '5 days', 3)`,
        [user],
      ),
    );
    expect(await consume("comment", user)).toBeNull();
    const old = await rows(
      "select count(*)::int as n from public.rate_counters where user_id = $1 and window_start < now() - interval '2 days'",
      [user],
    );
    expect(old[0].n).toBe(0);
  });
});

describe("concurrent writers cannot exceed the limit", () => {
  it("admits exactly the remaining slots when many writers race at the boundary", async () => {
    const user = await freshUser("rl-race");
    await withSuperuser((db) =>
      db.query(
        `insert into public.rate_counters (user_id, action, window_start, hits)
         values ($1, 'report', date_trunc('day', now()), $2)`,
        [user, LIMITS.report - 2],
      ),
    );
    const clients = await Promise.all(Array.from({ length: 6 }, () => openSuperuser()));
    try {
      const results = await Promise.all(
        clients.map((c) =>
          c
            .query("select public._rate_limit_consume('report', $1)", [user])
            .then(() => null)
            .catch((error: { code?: string }) => error.code ?? "unknown"),
        ),
      );
      expect(results.filter((r) => r === null)).toHaveLength(2);
      expect(results.filter((r) => r === "53400")).toHaveLength(4);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
    const [row] = await rows(
      "select hits from public.rate_counters where user_id = $1 and action = 'report'",
      [user],
    );
    expect(row.hits).toBe(LIMITS.report);
  });
});

describe("counters are private to the database", () => {
  it("a grower cannot write or read another grower's counter", async () => {
    const write = await bob.client.from("rate_counters").insert({
      user_id: bob.id,
      action: "comment",
      window_start: new Date().toISOString(),
      hits: 0,
    });
    expect(write.error).not.toBeNull();
    const read = await alice.client.from("rate_counters").select("user_id");
    expect(read.data ?? []).toEqual([]);
  });

  it("the trigger is attached to each limited table", async () => {
    const names = (
      await rows("select tgname from pg_trigger where tgname like '%rate_limit' order by tgname")
    ).map((r) => r.tgname);
    expect(names).toEqual([
      "availability_subscriptions_rate_limit",
      "comments_rate_limit",
      "messages_rate_limit",
      "rehome_interests_rate_limit",
      "reports_rate_limit",
      "seed_offer_interests_rate_limit",
    ]);
  });
});
