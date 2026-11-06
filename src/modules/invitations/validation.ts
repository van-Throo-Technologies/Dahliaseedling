import { msg, type Msg } from "@/i18n/message";
import { COUNTRY_CODES } from "@/modules/identity/country-codes";

/*
 * Pure validation for an invitation request. The database repeats the same bounds (see the invitation_requests migration), so a bypassed
 * form still cannot store bad data. Messages are keys, translated at the edge.
 */

export const INVITATION_LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  reasonMin: 10,
  reasonMax: 500,
} as const;

export interface InvitationRequestInput {
  readonly name: string;
  readonly countryCode: string;
  readonly email: string;
  readonly reason: string;
}

export type InvitationValidation =
  | { readonly ok: true; readonly value: InvitationRequestInput }
  | { readonly ok: false; readonly fieldErrors: Readonly<Record<string, Msg>> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Plain text only: tabs and line breaks are allowed in the reason; other control characters are not.
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function codePoints(value: string): number {
  return [...value].length;
}

/** The honeypot is a field that people do not see. Any value in it marks the submission as automated. */
export function isHoneypotFilled(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim() !== "";
}

export function validateInvitationRequest(raw: {
  readonly name: string;
  readonly countryCode: string;
  readonly email: string;
  readonly reason: string;
}): InvitationValidation {
  const name = raw.name.trim();
  const email = raw.email.trim().toLowerCase();
  const reason = raw.reason.trim();
  const countryCode = raw.countryCode.trim().toUpperCase();
  const fieldErrors: Record<string, Msg> = {};

  const nameLength = codePoints(name);
  if (
    nameLength < INVITATION_LIMITS.nameMin ||
    nameLength > INVITATION_LIMITS.nameMax ||
    CONTROL_CHARACTER.test(name)
  ) {
    fieldErrors.name = msg("invitations.errors.name");
  }
  if (!(COUNTRY_CODES as readonly string[]).includes(countryCode)) {
    fieldErrors.countryCode = msg("invitations.errors.country");
  }
  if (email.length > INVITATION_LIMITS.emailMax || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = msg("invitations.errors.email");
  }
  const reasonLength = codePoints(reason);
  if (
    reasonLength < INVITATION_LIMITS.reasonMin ||
    reasonLength > INVITATION_LIMITS.reasonMax ||
    CONTROL_CHARACTER.test(reason)
  ) {
    fieldErrors.reason = msg("invitations.errors.reason");
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { name, countryCode, email, reason } };
}
