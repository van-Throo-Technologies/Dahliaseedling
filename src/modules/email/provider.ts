/*
 * The application's email-delivery boundary. Domain code and the delivery worker depend on this interface only. The one module
 * that talks to a provider implements it, so replacing the provider does not touch the availability domain or the outbox.
 */

export interface OutgoingEmail {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface SendOptions {
  /** Stable per logical email, so a retried delivery is the same send to the provider. */
  readonly idempotencyKey: string;
}

/** Failures are classified, never described. The provider's own message is not stored or shown. */
export type ProviderResult =
  | { readonly ok: true; readonly messageId: string }
  | {
      readonly ok: false;
      readonly retryable: boolean;
      readonly code: "provider_temporary" | "provider_rejected";
    };

export interface EmailProvider {
  send(message: OutgoingEmail, options: SendOptions): Promise<ProviderResult>;
}
