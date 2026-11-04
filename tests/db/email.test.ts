import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Availability email delivery. The outbox is the boundary: an availability event writes one row per subscriber in the same
 * transaction as the in-app notification. The worker claims rows under a lease, decides from current state whether to send, and
 * records the outcome. These tests run the worker's database steps as the service role, without any provider.
 */

const visitor = anonClient();
const tag = "em" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser; // holder of the Seedlings
let bob: TestUser; // subscriber who reads French
let carol: TestUser; // subscriber, later suspended
let dan: TestUser; // subscribed, then unsubscribed before the event
let erin: TestUser; // unrelated grower
let seedling = "";
let caseId = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

/** Runs one statement list as the delivery worker's role, the only role that may call the worker functions. */
async function asWorker<T>(run: (db: import("pg").Client) => Promise<T>): Promise<T> {
  return withSuperuser(async (db) => {
    await db.query("set role service_role");
    try {
      return await run(db);
    } finally {
      await db.query("reset role");
    }
  });
}

/**
 * The worker's claim returns only the identifier, the claim token and the attempt count. The assertions below also need the
 * outbox details, which this test reads separately as a superuser; the worker itself never sees them from the claim.
 */
async function claim(limit = 10) {
  const claimed = await asWorker(
    async (db) =>
      (
        await db.query("select id, claim_token, attempts from public.email_claim_due($1, 300)", [
          limit,
        ])
      ).rows,
  );
  if (claimed.length === 0) return [];
  const details = await rows(
    "select id, recipient_id, rehome_case_id, locale, seedling_id from public.email_outbox where id = any($1::uuid[])",
    [claimed.map((r) => r.id)],
  );
  return claimed.map((c) => ({ ...c, ...details.find((d) => d.id === c.id) }));
}

async function newSeedling(name: string) {
  const { data, error } = await alice.client.rpc("create_seedling", {
    p_working_name: `${name} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

async function openCase(id: string) {
  const { data, error } = await alice.client.rpc("start_rehome", {
    p_seedling_id: id,
    p_term: "donate",
    p_price_text: null,
    p_handover: "pickup",
    p_note: null,
    p_make_public: false,
  });
  if (error) throw new Error(error.message);
  return (typeof data === "string" ? data : (data as { id: string }).id) as string;
}

beforeAll(async () => {
  alice = await createTestUser("em-alice");
  bob = await createTestUser("em-bob");
  carol = await createTestUser("em-carol");
  dan = await createTestUser("em-dan");
  erin = await createTestUser("em-erin");
  created.push(alice.id, bob.id, carol.id, dan.id, erin.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });
  await carol.client
    .from("profiles")
    .insert({ id: carol.id, display_name: `Carol ${tag}`, country_code: "DE" });
  await dan.client
    .from("profiles")
    .insert({ id: dan.id, display_name: `Dan ${tag}`, country_code: "FR" });
  await erin.client
    .from("profiles")
    .insert({ id: erin.id, display_name: `Erin ${tag}`, country_code: "NL" });

  seedling = await newSeedling("Availability");
  expect(
    (await bob.client.rpc("subscribe_availability", { p_seedling_id: seedling, p_locale: "fr" }))
      .error,
  ).toBeNull();
  expect(
    (await dan.client.rpc("subscribe_availability", { p_seedling_id: seedling, p_locale: "nl" }))
      .error,
  ).toBeNull();
  expect(
    (await dan.client.rpc("unsubscribe_availability", { p_seedling_id: seedling })).error,
  ).toBeNull();
  caseId = await openCase(seedling);
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the availability event writes exactly one outbox row per subscriber", () => {
  it("creates one pending alert for the active subscriber, in the language they subscribed with", async () => {
    const outbox = await rows(
      "select recipient_id, status, locale, kind from public.email_outbox where rehome_case_id = $1",
      [caseId],
    );
    expect(outbox).toEqual([
      { recipient_id: bob.id, status: "pending", locale: "fr", kind: "availability_alert" },
    ]);
  });

  it("the unsubscribed grower and the unrelated grower get no alert, and the holder gets none", async () => {
    const others = await rows(
      "select count(*)::int as n from public.email_outbox where rehome_case_id = $1 and recipient_id in ($2, $3, $4)",
      [caseId, dan.id, erin.id, alice.id],
    );
    expect(others[0].n).toBe(0);
  });

  it("a repeated availability event for the same case does not create a second logical email", async () => {
    await withSuperuser((db) =>
      db.query("update public.rehome_cases set status = 'cancelled' where id = $1", [caseId]),
    );
    await withSuperuser((db) =>
      db.query("update public.rehome_cases set status = 'available' where id = $1", [caseId]),
    );
    const outbox = await rows(
      "select count(*)::int as n from public.email_outbox where rehome_case_id = $1",
      [caseId],
    );
    const notes = await rows(
      "select count(*)::int as n from public.notifications where rehome_case_id = $1 and type = 'availability_trigger'",
      [caseId],
    );
    expect(outbox[0].n).toBe(1);
    expect(notes[0].n).toBe(1);
  });

  it("an unknown language falls back to English when the subscription is recorded", async () => {
    const other = await newSeedling("Fallback");
    expect(
      (await carol.client.rpc("subscribe_availability", { p_seedling_id: other, p_locale: "de" }))
        .error,
    ).toBeNull();
    const stored = await rows(
      "select locale from public.availability_subscriptions where user_id = $1 and seedling_id = $2",
      [carol.id, other],
    );
    expect(stored[0].locale).toBe("en");
  });
});

describe("clients cannot touch the outbox", () => {
  it("a grower cannot read, write or call the delivery functions", async () => {
    const read = await bob.client.from("email_outbox").select("id");
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true);
    const write = await bob.client.from("email_outbox").insert({
      recipient_id: bob.id,
      kind: "availability_alert",
      seedling_id: seedling,
      locale: "en",
      dedupe_key: crypto.randomUUID(),
    });
    expect(write.error).not.toBeNull();
    expect(
      errorCode(
        (await bob.client.rpc("email_claim_due", { p_limit: 5, p_lease_seconds: 300 })).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await bob.client.rpc("email_record_sent", {
            p_id: crypto.randomUUID(),
            p_claim_token: crypto.randomUUID(),
            p_provider_message_id: "x",
          })
        ).error,
      ),
    ).toBe("42501");
  });

  it("a visitor cannot call the delivery functions", async () => {
    expect(
      errorCode((await visitor.rpc("email_claim_due", { p_limit: 5, p_lease_seconds: 300 })).error),
    ).toBe("42501");
  });
});

describe("claiming and recording delivery", () => {
  it("the worker claims the pending alert under a lease, and a second claim finds nothing due", async () => {
    const first = await claim(10);
    const mine = first.find((r) => r.id && r.recipient_id === bob.id);
    expect(mine).toBeDefined();
    expect(mine!.locale).toBe("fr");
    const second = await claim(10);
    expect(second.find((r) => r.id === mine!.id)).toBeUndefined();
  });

  it("two workers claiming at the same moment never receive the same row", async () => {
    for (let i = 0; i < 8; i += 1) {
      await withSuperuser((db) =>
        db.query(
          `insert into public.email_outbox (recipient_id, kind, seedling_id, locale, dedupe_key)
           values ($1, 'availability_alert', $2, 'en', $3)`,
          [bob.id, seedling, `concurrency:${tag}:${i}`],
        ),
      );
    }
    const [a, b] = await Promise.all([claim(5), claim(5)]);
    const ids = [...a, ...b].map((r) => r.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(8);
  });

  it("a successful send is recorded with its provider message id, and cannot be recorded twice", async () => {
    const rowsClaimed = await rows(
      "select id, claim_token from public.email_outbox where dedupe_key like $1 and status = 'pending' and claim_token is not null limit 1",
      [`concurrency:${tag}:%`],
    );
    const row = rowsClaimed[0] as { id: string; claim_token: string };
    await asWorker((db) =>
      db.query("select public.email_record_sent($1, $2, $3)", [row.id, row.claim_token, "msg_123"]),
    );
    const stored = await rows(
      "select status, sent_at, provider_message_id, claim_token from public.email_outbox where id = $1",
      [row.id],
    );
    expect(stored[0].status).toBe("sent");
    expect(stored[0].sent_at).not.toBeNull();
    expect(stored[0].provider_message_id).toBe("msg_123");
    expect(stored[0].claim_token).toBeNull();
    await expect(
      asWorker((db) =>
        db.query("select public.email_record_sent($1, $2, $3)", [row.id, row.claim_token, "again"]),
      ),
    ).rejects.toMatchObject({ code: "P0002" });
  });

  it("a temporary failure stays retryable: it is not due at once, and it returns after its backoff", async () => {
    const pending = await rows(
      "select id, claim_token from public.email_outbox where dedupe_key like $1 and status = 'pending' and claim_token is not null limit 1",
      [`concurrency:${tag}:%`],
    );
    const row = pending[0] as { id: string; claim_token: string };
    await asWorker((db) =>
      db.query("select public.email_record_retry($1, $2, 'provider_temporary')", [
        row.id,
        row.claim_token,
      ]),
    );
    const after = await rows(
      "select status, attempts, last_failure, next_attempt_at > now() as later from public.email_outbox where id = $1",
      [row.id],
    );
    expect(after[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      last_failure: "provider_temporary",
      later: true,
    });
    const early = await claim(20);
    expect(early.find((r) => r.id === row.id)).toBeUndefined();

    await withSuperuser((db) =>
      db.query(
        "update public.email_outbox set next_attempt_at = now() - interval '1 minute' where id = $1",
        [row.id],
      ),
    );
    const again = await claim(20);
    const reclaimed = again.find((r) => r.id === row.id);
    expect(reclaimed).toBeDefined();
    expect(reclaimed!.attempts).toBe(2);
  });

  it("repeated temporary failures end after five attempts, and then the row is failed rather than retried forever", async () => {
    const id = (
      await rows(
        "select id from public.email_outbox where dedupe_key like $1 and status = 'pending' and claim_token is not null limit 1",
        [`concurrency:${tag}:%`],
      )
    )[0].id as string;
    await withSuperuser((db) =>
      db.query(
        "update public.email_outbox set attempts = 5, claim_token = gen_random_uuid(), claimed_until = now() + interval '5 minutes' where id = $1 returning id",
        [id],
      ),
    );
    const token = (await rows("select claim_token from public.email_outbox where id = $1", [id]))[0]
      .claim_token as string;
    await asWorker((db) =>
      db.query("select public.email_record_retry($1, $2, 'provider_temporary')", [id, token]),
    );
    const stored = await rows(
      "select status, last_failure from public.email_outbox where id = $1",
      [id],
    );
    expect(stored[0]).toEqual({ status: "failed", last_failure: "attempts_exhausted" });
  });

  it("a permanent rejection is final, and the row is never claimed again", async () => {
    await withSuperuser((db) =>
      db.query(
        `insert into public.email_outbox (recipient_id, kind, seedling_id, locale, dedupe_key)
       values ($1, 'availability_alert', $2, 'en', $3)`,
        [bob.id, seedling, `permanent:${tag}`],
      ),
    );
    const insertedId = (
      await rows("select id from public.email_outbox where dedupe_key = $1", [`permanent:${tag}`])
    )[0].id as string;
    const row = (await claim(50)).find((r) => r.id === insertedId)!;
    expect(row).toBeDefined();
    await asWorker((db) =>
      db.query("select public.email_record_failed($1, $2, 'provider_rejected')", [
        row.id,
        row.claim_token,
      ]),
    );
    const stored = await rows(
      "select status, last_failure, sent_at from public.email_outbox where id = $1",
      [row.id],
    );
    expect(stored[0]).toEqual({
      status: "failed",
      last_failure: "provider_rejected",
      sent_at: null,
    });
    await withSuperuser((db) =>
      db.query("update public.email_outbox set next_attempt_at = now() where id = $1", [row.id]),
    );
    const later = await claim(50);
    expect(later.find((r) => r.id === row.id)).toBeUndefined();
  });

  it("a lapsed lease is claimed again, and the earlier worker can no longer record an outcome", async () => {
    await withSuperuser((db) =>
      db.query(
        `insert into public.email_outbox (recipient_id, kind, seedling_id, locale, dedupe_key)
       values ($1, 'availability_alert', $2, 'en', $3)`,
        [bob.id, seedling, `lease:${tag}`],
      ),
    );
    const [first] = (await claim(50)).filter(
      (r) => r.dedupe_key === undefined && r.recipient_id === bob.id,
    );
    const target = (
      await rows("select id, claim_token from public.email_outbox where dedupe_key = $1", [
        `lease:${tag}`,
      ])
    )[0] as { id: string; claim_token: string };
    expect(first).toBeDefined();
    await withSuperuser((db) =>
      db.query(
        "update public.email_outbox set claimed_until = now() - interval '1 second' where id = $1",
        [target.id],
      ),
    );
    const reclaimed = (await claim(50)).find((r) => r.id === target.id);
    expect(reclaimed).toBeDefined();
    expect(reclaimed!.claim_token).not.toBe(target.claim_token);
    await expect(
      asWorker((db) =>
        db.query("select public.email_record_sent($1, $2, 'stale')", [
          target.id,
          target.claim_token,
        ]),
      ),
    ).rejects.toMatchObject({ code: "P0002" });
    await asWorker((db) =>
      db.query("select public.email_record_sent($1, $2, 'current')", [
        target.id,
        reclaimed!.claim_token,
      ]),
    );
  });
});

describe("delivery is decided from current state, and the address is read only at send time", () => {
  it("the context carries the recipient address, the locale and the Seedling name for a live alert", async () => {
    await withSuperuser((db) =>
      db.query(
        "update public.email_outbox set next_attempt_at = now(), claimed_until = null, claim_token = null where rehome_case_id = $1 and status = 'pending'",
        [caseId],
      ),
    );
    const claimed = (await claim(50)).find((r) => r.rehome_case_id === caseId);
    expect(claimed).toBeDefined();
    const ctx = await asWorker((db) =>
      db.query("select * from public.email_delivery_context($1, $2)", [
        claimed!.id,
        claimed!.claim_token,
      ]),
    );
    expect(ctx.rows[0]).toMatchObject({
      recipient_email: bob.email,
      locale: "fr",
      seedling_id: seedling,
      seedling_name: `Availability ${tag}`,
      suppressed_reason: null,
    });
  });

  it("a context for a claim the worker does not hold is refused", async () => {
    await expect(
      asWorker((db) =>
        db.query("select * from public.email_delivery_context($1, $2)", [
          crypto.randomUUID(),
          crypto.randomUUID(),
        ]),
      ),
    ).rejects.toMatchObject({ code: "P0002" });
  });

  it("an alert whose subscriber has since unsubscribed is suppressed, not sent", async () => {
    const other = await newSeedling("Unsubscribed");
    expect(
      (await carol.client.rpc("subscribe_availability", { p_seedling_id: other, p_locale: "en" }))
        .error,
    ).toBeNull();
    const otherCase = await openCase(other);
    // The event happened while Carol was subscribed, so the alert exists; then she stopped the alerts.
    const queued = await rows(
      "select count(*)::int as n from public.email_outbox where rehome_case_id = $1 and recipient_id = $2",
      [otherCase, carol.id],
    );
    expect(queued[0].n).toBe(1);
    expect(
      (await carol.client.rpc("unsubscribe_availability", { p_seedling_id: other })).error,
    ).toBeNull();
    await withSuperuser((db) =>
      db.query(
        "update public.email_outbox set next_attempt_at = now(), claimed_until = null, claim_token = null where rehome_case_id = $1",
        [otherCase],
      ),
    );
    const claimed = (await claim(50)).find((r) => r.rehome_case_id === otherCase);
    expect(claimed).toBeDefined();
    const ctx = await asWorker((db) =>
      db.query("select * from public.email_delivery_context($1, $2)", [
        claimed!.id,
        claimed!.claim_token,
      ]),
    );
    expect(ctx.rows[0].suppressed_reason).toBe("subscription_closed");
  });

  it("an alert for a suspended recipient is suppressed, and the suspension is not changed", async () => {
    const other = await newSeedling("Suspended");
    expect(
      (await carol.client.rpc("subscribe_availability", { p_seedling_id: other, p_locale: "en" }))
        .error,
    ).toBeNull();
    const otherCase = await openCase(other);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [carol.id]),
    );
    try {
      await withSuperuser((db) =>
        db.query(
          "update public.email_outbox set next_attempt_at = now() where rehome_case_id = $1",
          [otherCase],
        ),
      );
      const claimed = (await claim(50)).find((r) => r.rehome_case_id === otherCase);
      expect(claimed).toBeDefined();
      const ctx = await asWorker((db) =>
        db.query("select * from public.email_delivery_context($1, $2)", [
          claimed!.id,
          claimed!.claim_token,
        ]),
      );
      expect(ctx.rows[0].suppressed_reason).toBe("recipient_unavailable");
      await asWorker((db) =>
        db.query("select public.email_record_failed($1, $2, $3)", [
          claimed!.id,
          claimed!.claim_token,
          "recipient_unavailable",
        ]),
      );
      const stored = await rows(
        "select status, last_failure from public.email_outbox where id = $1",
        [claimed!.id],
      );
      expect(stored[0]).toEqual({ status: "failed", last_failure: "recipient_unavailable" });
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [carol.id]),
      );
    }
  });

  it("an alert for a continuation that is no longer available is suppressed", async () => {
    const other = await newSeedling("Taken");
    expect(
      (await bob.client.rpc("subscribe_availability", { p_seedling_id: other, p_locale: "fr" }))
        .error,
    ).toBeNull();
    const otherCase = await openCase(other);
    await withSuperuser((db) =>
      db.query("update public.rehome_cases set status = 'cancelled' where id = $1", [otherCase]),
    );
    await withSuperuser((db) =>
      db.query("update public.email_outbox set next_attempt_at = now() where rehome_case_id = $1", [
        otherCase,
      ]),
    );
    const claimed = (await claim(50)).find((r) => r.rehome_case_id === otherCase);
    expect(claimed).toBeDefined();
    const ctx = await asWorker((db) =>
      db.query("select * from public.email_delivery_context($1, $2)", [
        claimed!.id,
        claimed!.claim_token,
      ]),
    );
    expect(ctx.rows[0].suppressed_reason).toBe("no_longer_available");
  });
});
