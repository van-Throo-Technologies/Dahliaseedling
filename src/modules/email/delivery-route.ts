import { timingSafeEqual } from "node:crypto";
import type { DeliverySummary } from "./delivery";

/*
 * The delivery endpoint's boundary. The endpoint is for the platform scheduler only: it runs when a request carries the
 * deployment's CRON_SECRET as a bearer token. With no secret configured it refuses everything. Responses carry counts only, never
 * an address, an email body, a claim token or a provider detail.
 */

const NO_STORE = { "Cache-Control": "private, no-store" };

/** True only for the exact bearer token. The comparison is constant-time, and an absent secret never matches. */
export function isAuthorizedScheduler(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function handleDeliveryRequest(
  request: Request,
  deps: {
    readonly secret: string | undefined;
    readonly run: () => Promise<DeliverySummary>;
    readonly notConfigured: () => boolean;
  },
): Promise<Response> {
  if (!isAuthorizedScheduler(request.headers.get("authorization"), deps.secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (deps.notConfigured()) {
    return Response.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  }
  try {
    const summary = await deps.run();
    return Response.json({ ok: true, ...summary }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "delivery_failed" }, { status: 500, headers: NO_STORE });
  }
}
