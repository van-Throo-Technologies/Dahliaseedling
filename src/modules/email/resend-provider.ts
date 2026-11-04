import "server-only";
import { Resend } from "resend";
import type { EmailProvider, OutgoingEmail, ProviderResult, SendOptions } from "./provider";

/*
 * The Resend adapter, and the only module that imports the Resend SDK. A temporary failure (no response, rate limiting, or a
 * server error) is retryable. Any other client error means the request itself will not succeed, so it is final. The SDK's
 * error text is never returned, so provider details cannot reach the database, the logs or a visitor.
 */

export function createResendProvider(apiKey: string): EmailProvider {
  const client = new Resend(apiKey);
  return {
    async send(message: OutgoingEmail, options: SendOptions): Promise<ProviderResult> {
      try {
        const { data, error } = await client.emails.send(
          {
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          },
          { idempotencyKey: options.idempotencyKey },
        );
        if (error || !data) {
          const status = error?.statusCode ?? null;
          const retryable = status === null || status === 429 || status >= 500;
          return {
            ok: false,
            retryable,
            code: retryable ? "provider_temporary" : "provider_rejected",
          };
        }
        return { ok: true, messageId: data.id };
      } catch {
        return { ok: false, retryable: true, code: "provider_temporary" };
      }
    },
  };
}
