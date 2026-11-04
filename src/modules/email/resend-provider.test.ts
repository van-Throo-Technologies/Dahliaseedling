import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** A stand-in for the SDK, so no request leaves the test process. The adapter's own behaviour is what is under test. */
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
    constructor(readonly key: string) {}
  },
}));

import { createResendProvider } from "./resend-provider";

const message = {
  from: "DahliaSeedling <notifications@example.test>",
  to: "grower@example.test",
  subject: "Subject",
  text: "Text",
  html: "<p>Text</p>",
};

beforeEach(() => send.mockReset());

describe("Resend adapter", () => {
  it("sends the request shape the provider expects, with the stable idempotency key", async () => {
    send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const result = await createResendProvider("re_test_key").send(message, {
      idempotencyKey: "dahlia-availability:abc",
    });
    expect(result).toEqual({ ok: true, messageId: "msg_1" });
    expect(send).toHaveBeenCalledWith(
      {
        from: message.from,
        to: ["grower@example.test"],
        subject: "Subject",
        text: "Text",
        html: "<p>Text</p>",
      },
      { idempotencyKey: "dahlia-availability:abc" },
    );
  });

  it("rate limiting and server errors are temporary", async () => {
    for (const statusCode of [429, 500, 503]) {
      send.mockResolvedValueOnce({
        data: null,
        error: { name: "x", message: "provider text that must not leak", statusCode },
      });
      const result = await createResendProvider("k").send(message, { idempotencyKey: "k" });
      expect(result).toEqual({ ok: false, retryable: true, code: "provider_temporary" });
    }
  });

  it("a client error for this request is permanent", async () => {
    send.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "bad", statusCode: 422 },
    });
    const result = await createResendProvider("k").send(message, { idempotencyKey: "k" });
    expect(result).toEqual({ ok: false, retryable: false, code: "provider_rejected" });
  });

  it("no response at all, or a thrown error, is temporary", async () => {
    send.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await createResendProvider("k").send(message, { idempotencyKey: "k" })).toEqual({
      ok: false,
      retryable: true,
      code: "provider_temporary",
    });
    send.mockResolvedValueOnce({
      data: null,
      error: { name: "x", message: "net", statusCode: null },
    });
    expect(await createResendProvider("k").send(message, { idempotencyKey: "k" })).toEqual({
      ok: false,
      retryable: true,
      code: "provider_temporary",
    });
  });

  it("the provider's own text and the API key never appear in the result", async () => {
    send.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "API key re_test_key invalid", statusCode: 403 },
    });
    const result = await createResendProvider("re_test_key").send(message, { idempotencyKey: "k" });
    expect(JSON.stringify(result)).not.toContain("re_test_key");
    expect(JSON.stringify(result)).not.toContain("invalid");
  });
});
