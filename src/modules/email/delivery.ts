import { renderAvailabilityEmail } from "./availability-email";
import type { EmailProvider } from "./provider";

/*
 * The delivery processor. It claims due outbox rows, asks the database whether each alert should still be sent, sends it through
 * the provider boundary, and records the outcome. It holds no state of its own: a crash between two steps leaves the row claimed,
 * the lease expires, and the row becomes due again. Each logical email has one stable idempotency key, so a retried delivery is
 * the same send to the provider.
 */

export type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string } | null }>;

export interface DeliveryDeps {
  readonly rpc: Rpc;
  readonly provider: EmailProvider;
  readonly fromAddress: string;
  readonly appBaseUrl: string;
}

export interface DeliverySummary {
  readonly claimed: number;
  readonly sent: number;
  readonly retried: number;
  readonly failed: number;
  readonly suppressed: number;
  readonly skipped: number;
}

interface Claim {
  readonly id: string;
  readonly claim_token: string;
}

interface Context {
  readonly recipient_email: string | null;
  readonly locale: string;
  readonly seedling_id: string;
  readonly seedling_name: string | null;
  readonly suppressed_reason: string | null;
}

type Outcome = "sent" | "retried" | "failed" | "suppressed" | "skipped";

/** The idempotency key is the outbox row, so every attempt at one logical email carries the same key. */
export function idempotencyKeyFor(outboxId: string): string {
  return `dahlia-availability:${outboxId}`;
}

async function call<T>(
  deps: DeliveryDeps,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await deps.rpc(name, args);
  if (error) throw Object.assign(new Error(name), { code: error.code });
  return data as T;
}

export async function deliverDueEmails(deps: DeliveryDeps, limit = 10): Promise<DeliverySummary> {
  const claims = await call<Claim[]>(deps, "email_claim_due", {
    p_limit: limit,
    p_lease_seconds: 300,
  });
  const summary = {
    claimed: claims.length,
    sent: 0,
    retried: 0,
    failed: 0,
    suppressed: 0,
    skipped: 0,
  };
  for (const claim of claims) {
    const outcome = await deliverOne(deps, claim);
    summary[outcome] += 1;
  }
  return summary;
}

async function deliverOne(deps: DeliveryDeps, claim: Claim): Promise<Outcome> {
  const args = { p_id: claim.id, p_claim_token: claim.claim_token };
  let context: Context[];
  try {
    context = await call<Context[]>(deps, "email_delivery_context", args);
  } catch (error) {
    // The claim is no longer ours, or the read failed. Nothing is recorded; the lease expires and the row is retried later.
    return (error as { code?: string }).code === "P0002" ? "skipped" : "retried";
  }
  const row = context[0];
  if (!row) return "skipped";

  if (row.suppressed_reason || !row.recipient_email) {
    await call(deps, "email_record_failed", {
      ...args,
      p_failure: row.suppressed_reason ?? "recipient_unavailable",
    });
    return "suppressed";
  }

  const rendered = renderAvailabilityEmail({
    locale: row.locale,
    seedlingName: row.seedling_name,
    seedlingId: row.seedling_id,
    baseUrl: deps.appBaseUrl,
  });

  let result;
  try {
    result = await deps.provider.send(
      {
        from: deps.fromAddress,
        to: row.recipient_email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      },
      { idempotencyKey: idempotencyKeyFor(claim.id) },
    );
  } catch {
    result = { ok: false as const, retryable: true, code: "provider_temporary" as const };
  }

  if (result.ok) {
    await call(deps, "email_record_sent", { ...args, p_provider_message_id: result.messageId });
    return "sent";
  }
  if (result.retryable) {
    await call(deps, "email_record_retry", { ...args, p_failure: result.code });
    return "retried";
  }
  await call(deps, "email_record_failed", { ...args, p_failure: result.code });
  return "failed";
}
