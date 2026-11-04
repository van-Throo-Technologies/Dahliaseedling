import { describe, expect, it } from "vitest";
import { deliverDueEmails, idempotencyKeyFor, type DeliveryDeps, type Rpc } from "./delivery";
import type { EmailProvider, OutgoingEmail, ProviderResult, SendOptions } from "./provider";

/*
 * The processor's behaviour with a scripted database and a scripted provider. No network, no real database: the test asserts which
 * steps run, in which order, with which idempotency key and which recorded outcome.
 */

const APP = "https://dahlia.example";
const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  claim_token: "22222222-2222-4222-8222-222222222222",
  locale: "fr",
  seedling_id: "33333333-3333-4333-8333-333333333333",
  attempts: 1,
};

function fakeDb(
  context: Partial<{
    recipient_email: string | null;
    suppressed_reason: string | null;
    seedling_name: string | null;
  }> = {},
) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === "email_claim_due") return { data: [ROW], error: null };
    if (name === "email_delivery_context") {
      return {
        data: [
          {
            recipient_email: "grower@example.test",
            locale: "fr",
            seedling_id: ROW.seedling_id,
            seedling_name: "Sunset Dream",
            suppressed_reason: null,
            ...context,
          },
        ],
        error: null,
      };
    }
    return { data: null, error: null };
  };
  return { calls, rpc };
}

function scriptedProvider(
  result: ProviderResult | (() => never),
): EmailProvider & { sent: { message: OutgoingEmail; options: SendOptions }[] } {
  const sent: { message: OutgoingEmail; options: SendOptions }[] = [];
  return {
    sent,
    async send(message, options) {
      sent.push({ message, options });
      if (typeof result === "function") return result();
      return result;
    },
  };
}

function deps(rpc: Rpc, provider: EmailProvider): DeliveryDeps {
  return {
    rpc,
    provider,
    fromAddress: "DahliaSeedling <notifications@example.test>",
    appBaseUrl: APP,
  };
}

describe("delivery of one claimed alert", () => {
  it("sends the rendered French alert with the stable key and records the provider id", async () => {
    const db = fakeDb();
    const provider = scriptedProvider({ ok: true, messageId: "msg_9" });
    const summary = await deliverDueEmails(deps(db.rpc, provider));
    expect(summary).toMatchObject({
      claimed: 1,
      sent: 1,
      retried: 0,
      failed: 0,
      suppressed: 0,
      skipped: 0,
    });

    expect(provider.sent).toHaveLength(1);
    const { message, options } = provider.sent[0]!;
    expect(message.to).toBe("grower@example.test");
    expect(message.subject).toBe("Un semis que vous avez demandé est maintenant disponible");
    expect(message.text).toContain(`${APP}/seedlings/${ROW.seedling_id}`);
    expect(options.idempotencyKey).toBe(idempotencyKeyFor(ROW.id));
    expect(options.idempotencyKey).toBe(`dahlia-availability:${ROW.id}`);

    const recorded = db.calls.at(-1)!;
    expect(recorded).toEqual({
      name: "email_record_sent",
      args: { p_id: ROW.id, p_claim_token: ROW.claim_token, p_provider_message_id: "msg_9" },
    });
  });

  it("a temporary provider failure records a retry with a code only", async () => {
    const db = fakeDb();
    const summary = await deliverDueEmails(
      deps(db.rpc, scriptedProvider({ ok: false, retryable: true, code: "provider_temporary" })),
    );
    expect(summary.retried).toBe(1);
    expect(db.calls.at(-1)).toEqual({
      name: "email_record_retry",
      args: { p_id: ROW.id, p_claim_token: ROW.claim_token, p_failure: "provider_temporary" },
    });
  });

  it("a permanent rejection is recorded as final", async () => {
    const db = fakeDb();
    const summary = await deliverDueEmails(
      deps(db.rpc, scriptedProvider({ ok: false, retryable: false, code: "provider_rejected" })),
    );
    expect(summary.failed).toBe(1);
    expect(db.calls.at(-1)!.name).toBe("email_record_failed");
    expect(db.calls.at(-1)!.args.p_failure).toBe("provider_rejected");
  });

  it("a provider that throws is treated as temporary, so nothing is lost", async () => {
    const db = fakeDb();
    const summary = await deliverDueEmails(
      deps(
        db.rpc,
        scriptedProvider(() => {
          throw new Error("boom");
        }),
      ),
    );
    expect(summary.retried).toBe(1);
    expect(db.calls.at(-1)!.name).toBe("email_record_retry");
  });

  it("a suppressed alert is never sent; it is recorded as failed with the reason", async () => {
    const db = fakeDb({ suppressed_reason: "subscription_closed" });
    const provider = scriptedProvider({ ok: true, messageId: "never" });
    const summary = await deliverDueEmails(deps(db.rpc, provider));
    expect(summary.suppressed).toBe(1);
    expect(provider.sent).toHaveLength(0);
    expect(db.calls.at(-1)).toEqual({
      name: "email_record_failed",
      args: { p_id: ROW.id, p_claim_token: ROW.claim_token, p_failure: "subscription_closed" },
    });
  });

  it("a row with no reachable address is suppressed, not sent", async () => {
    const db = fakeDb({ recipient_email: null });
    const provider = scriptedProvider({ ok: true, messageId: "never" });
    await deliverDueEmails(deps(db.rpc, provider));
    expect(provider.sent).toHaveLength(0);
    expect(db.calls.at(-1)!.args.p_failure).toBe("recipient_unavailable");
  });

  it("a claim the worker no longer holds is skipped without any write", async () => {
    const calls: string[] = [];
    const rpc: Rpc = async (name) => {
      calls.push(name);
      if (name === "email_claim_due") return { data: [ROW], error: null };
      return { data: null, error: { code: "P0002" } };
    };
    const summary = await deliverDueEmails(
      deps(rpc, scriptedProvider({ ok: true, messageId: "x" })),
    );
    expect(summary.skipped).toBe(1);
    expect(calls).toEqual(["email_claim_due", "email_delivery_context"]);
  });

  it("with nothing due, nothing is sent and nothing is recorded", async () => {
    const calls: string[] = [];
    const rpc: Rpc = async (name) => {
      calls.push(name);
      return { data: [], error: null };
    };
    const provider = scriptedProvider({ ok: true, messageId: "x" });
    const summary = await deliverDueEmails(deps(rpc, provider));
    expect(summary).toEqual({
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      suppressed: 0,
      skipped: 0,
    });
    expect(calls).toEqual(["email_claim_due"]);
    expect(provider.sent).toHaveLength(0);
  });

  it("the same logical email always carries the same key, so a retry is the same send", () => {
    expect(idempotencyKeyFor(ROW.id)).toBe(idempotencyKeyFor(ROW.id));
    expect(idempotencyKeyFor(ROW.id)).not.toBe(
      idempotencyKeyFor("44444444-4444-4444-8444-444444444444"),
    );
  });
});
