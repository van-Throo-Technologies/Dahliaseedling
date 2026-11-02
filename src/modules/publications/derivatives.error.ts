import type { MessageKey } from "@/i18n/translator";

/** A public copy that could not be made. It carries a key, so the interface can show it in the visitor's language. */
export class DerivativeError extends Error {
  readonly key: MessageKey;

  constructor(key: MessageKey) {
    super(key);
    this.key = key;
  }
}
