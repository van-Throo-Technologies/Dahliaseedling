import type { MessageKey } from "@/i18n/translator";

/*
 * Stable keys from the address bar, mapped to dictionary keys. A key that is not listed here is shown as the generic
 * sentence, so a stray or old query parameter never displays raw text.
 */

export const MESSAGING_ERRORS: Record<string, MessageKey> = {
  notAllowed: "messaging.errors.notAllowed",
  notFound: "messaging.errors.notFound",
  blocked: "messaging.errors.blocked",
  empty: "messaging.errors.empty",
  tooLong: "messaging.errors.tooLong",
  photoType: "messaging.errors.photoType",
  photoSize: "messaging.errors.photoSize",
  unavailable: "messaging.errors.unavailable",
  generic: "messaging.errors.generic",
  reason: "safety.errors.reason",
  details: "safety.errors.details",
  self: "safety.errors.self",
};

export const MESSAGING_NOTICES: Record<string, MessageKey> = {
  sent: "messaging.notice.sent",
  subscribed: "messaging.notice.subscribed",
  unsubscribed: "messaging.notice.unsubscribed",
  blocked: "safety.block.blocked",
  unblocked: "safety.block.unblocked",
  reported: "safety.report.sent",
};
