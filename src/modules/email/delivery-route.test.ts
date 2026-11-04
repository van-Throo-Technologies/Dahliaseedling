import { describe, expect, it, vi } from "vitest";
import { handleDeliveryRequest, isAuthorizedScheduler } from "./delivery-route";

const SECRET = "scheduler-secret-for-tests-only";
const summary = { claimed: 2, sent: 1, retried: 1, failed: 0, suppressed: 0, skipped: 0 };

function request(authorization?: string) {
  return new Request("https://dahlia.example/api/email/deliver", {
    method: "GET",
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("who may trigger delivery", () => {
  it("accepts only the exact bearer token", () => {
    expect(isAuthorizedScheduler(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedScheduler(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedScheduler(`Basic ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedScheduler(null, SECRET)).toBe(false);
    expect(isAuthorizedScheduler("", SECRET)).toBe(false);
  });

  it("with no secret configured, nothing is authorized, even an empty bearer", () => {
    expect(isAuthorizedScheduler("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedScheduler("Bearer undefined", undefined)).toBe(false);
  });
});

describe("the delivery endpoint", () => {
  it("refuses an ordinary browser request without touching the outbox", async () => {
    const run = vi.fn();
    const response = await handleDeliveryRequest(request(), {
      secret: SECRET,
      run,
      notConfigured: () => false,
    });
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret, and refuses everything when no secret is configured", async () => {
    const run = vi.fn();
    expect(
      (
        await handleDeliveryRequest(request("Bearer wrong"), {
          secret: SECRET,
          run,
          notConfigured: () => false,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await handleDeliveryRequest(request("Bearer anything"), {
          secret: undefined,
          run,
          notConfigured: () => false,
        })
      ).status,
    ).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("with the right secret, runs one delivery pass and returns counts only", async () => {
    const run = vi.fn().mockResolvedValue(summary);
    const response = await handleDeliveryRequest(request(`Bearer ${SECRET}`), {
      secret: SECRET,
      run,
      notConfigured: () => false,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body).toEqual({ ok: true, ...summary });
    expect(JSON.stringify(body)).not.toMatch(/@|token|key|http/i);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("when email is not configured, it says so by name-free status and claims nothing", async () => {
    const run = vi.fn();
    const response = await handleDeliveryRequest(request(`Bearer ${SECRET}`), {
      secret: SECRET,
      run,
      notConfigured: () => true,
    });
    expect(response.status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it("an unexpected failure is reported without its cause", async () => {
    const run = vi
      .fn()
      .mockRejectedValue(new Error("connection refused to 10.0.0.1 with key sk_live_123"));
    const response = await handleDeliveryRequest(request(`Bearer ${SECRET}`), {
      secret: SECRET,
      run,
      notConfigured: () => false,
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("10.0.0.1");
    expect(text).not.toContain("sk_live");
  });
});
