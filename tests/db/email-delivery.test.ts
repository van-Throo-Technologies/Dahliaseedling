import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deliverDueEmails, type Rpc } from "../../src/modules/email/delivery";
import type {
  EmailProvider,
  OutgoingEmail,
  ProviderResult,
} from "../../src/modules/email/provider";
import {
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * The delivery processor against the real database. Only the provider is replaced: it records what would have been sent and
 * returns a scripted result. Every database step runs through the same functions the worker calls, as the service role.
 */

const tag = "dl" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser;
let bob: TestUser;
let seedling = "";
let caseId = "";

/** The processor's RPC, implemented over one connection that runs as the service role. */
function serviceRpc(db: import("pg").Client): Rpc {
  return async (name, args) => {
    const keys = Object.keys(args);
    const sql = `select * from public.${name}(${keys.map((key, i) => `${key} => $${i + 1}`).join(", ")})`;
    try {
      const result = await db.query(
        sql,
        keys.map((key) => args[key]),
      );
      return { data: result.rows, error: null };
    } catch (error) {
      return { data: null, error: { code: (error as { code?: string }).code } };
    }
  };
}

function recordingProvider(result: ProviderResult): EmailProvider & { sent: OutgoingEmail[] } {
  const sent: OutgoingEmail[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
      return result;
    },
  };
}

async function asService<T>(run: (rpc: Rpc) => Promise<T>): Promise<T> {
  return withSuperuser(async (db) => {
    await db.query("set role service_role");
    try {
      return await run(serviceRpc(db));
    } finally {
      await db.query("reset role");
    }
  });
}

const config = {
  fromAddress: "DahliaSeedling <notifications@example.test>",
  appBaseUrl: "https://dahlia.example",
};

beforeAll(async () => {
  alice = await createTestUser("dl-alice");
  bob = await createTestUser("dl-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });
  const { data, error } = await alice.client.rpc("create_seedling", {
    p_working_name: `Delivered ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  seedling = data!.id as string;
  expect(
    (await bob.client.rpc("subscribe_availability", { p_seedling_id: seedling, p_locale: "nl" }))
      .error,
  ).toBeNull();
  const started = await alice.client.rpc("start_rehome", {
    p_seedling_id: seedling,
    p_term: "donate",
    p_price_text: null,
    p_handover: "pickup",
    p_note: null,
    p_make_public: false,
  });
  if (started.error) throw new Error(started.error.message);
  caseId = (
    typeof started.data === "string" ? started.data : (started.data as { id: string }).id
  ) as string;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("pending outbox → claimed → sent, through the real database", () => {
  it("a pending alert is claimed, sent once to the subscriber in Dutch, and recorded as sent", async () => {
    const provider = recordingProvider({ ok: true, messageId: "msg_integration_1" });
    const summary = await asService((rpc) => deliverDueEmails({ rpc, provider, ...config }));
    expect(summary).toMatchObject({ sent: 1, failed: 0, retried: 0 });

    expect(provider.sent).toHaveLength(1);
    const email = provider.sent[0]!;
    expect(email.to).toBe(bob.email);
    expect(email.subject).toBe("Een zaailing waar je om vroeg is, is nu beschikbaar");
    expect(email.text).toContain(`https://dahlia.example/seedlings/${seedling}`);
    expect(email.text).toContain(`Delivered ${tag}`);

    const stored = await withSuperuser(
      async (db) =>
        (
          await db.query(
            "select status, sent_at is not null as has_sent_at, provider_message_id, claim_token from public.email_outbox where rehome_case_id = $1",
            [caseId],
          )
        ).rows,
    );
    expect(stored).toEqual([
      {
        status: "sent",
        has_sent_at: true,
        provider_message_id: "msg_integration_1",
        claim_token: null,
      },
    ]);
  });

  it("a second worker run finds nothing to send, so the same alert is never delivered again", async () => {
    const provider = recordingProvider({ ok: true, messageId: "msg_integration_2" });
    const summary = await asService((rpc) => deliverDueEmails({ rpc, provider, ...config }));
    expect(summary.claimed).toBe(0);
    expect(provider.sent).toHaveLength(0);
  });
});

describe("provider failure through the real database", () => {
  it("a temporary failure leaves the alert retryable and not lost, with a stored code and no provider text", async () => {
    const other = await alice.client.rpc("create_seedling", {
      p_working_name: `Retry ${tag}`,
      p_visibility: "public",
    });
    const otherSeedling = other.data!.id as string;
    expect(
      (
        await bob.client.rpc("subscribe_availability", {
          p_seedling_id: otherSeedling,
          p_locale: "en",
        })
      ).error,
    ).toBeNull();
    const started = await alice.client.rpc("start_rehome", {
      p_seedling_id: otherSeedling,
      p_term: "donate",
      p_price_text: null,
      p_handover: "pickup",
      p_note: null,
      p_make_public: false,
    });
    const retryCase = (
      typeof started.data === "string" ? started.data : (started.data as { id: string }).id
    ) as string;

    const provider = recordingProvider({ ok: false, retryable: true, code: "provider_temporary" });
    const summary = await asService((rpc) => deliverDueEmails({ rpc, provider, ...config }));
    expect(summary.retried).toBe(1);
    const stored = await withSuperuser(
      async (db) =>
        (
          await db.query(
            "select status, attempts, last_failure, next_attempt_at > now() as later from public.email_outbox where rehome_case_id = $1",
            [retryCase],
          )
        ).rows,
    );
    expect(stored).toEqual([
      { status: "pending", attempts: 1, last_failure: "provider_temporary", later: true },
    ]);
  });

  it("a permanent rejection is final through the real database: the row is failed and the processor never sends it again", async () => {
    const other = await alice.client.rpc("create_seedling", {
      p_working_name: `Rejected ${tag}`,
      p_visibility: "public",
    });
    const rejectedSeedling = other.data!.id as string;
    expect(
      (
        await bob.client.rpc("subscribe_availability", {
          p_seedling_id: rejectedSeedling,
          p_locale: "en",
        })
      ).error,
    ).toBeNull();
    const started = await alice.client.rpc("start_rehome", {
      p_seedling_id: rejectedSeedling,
      p_term: "donate",
      p_price_text: null,
      p_handover: "pickup",
      p_note: null,
      p_make_public: false,
    });
    const rejectedCase = (
      typeof started.data === "string" ? started.data : (started.data as { id: string }).id
    ) as string;

    const rejecting = recordingProvider({ ok: false, retryable: false, code: "provider_rejected" });
    await asService((rpc) => deliverDueEmails({ rpc, provider: rejecting, ...config }));
    const stored = await withSuperuser(
      async (db) =>
        (
          await db.query(
            "select status, attempts, last_failure, sent_at from public.email_outbox where rehome_case_id = $1",
            [rejectedCase],
          )
        ).rows,
    );
    expect(stored).toEqual([
      { status: "failed", attempts: 1, last_failure: "provider_rejected", sent_at: null },
    ]);

    const again = recordingProvider({ ok: true, messageId: "must_not_send" });
    await asService((rpc) => deliverDueEmails({ rpc, provider: again, ...config }));
    expect(again.sent.filter((m) => m.text.includes(rejectedSeedling))).toHaveLength(0);
    const unchanged = await withSuperuser(
      async (db) =>
        (
          await db.query(
            "select status, attempts from public.email_outbox where rehome_case_id = $1",
            [rejectedCase],
          )
        ).rows,
    );
    expect(unchanged).toEqual([{ status: "failed", attempts: 1 }]);
  });
});
