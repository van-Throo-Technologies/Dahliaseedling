import { safeNextPath } from "@/lib/http/safe-next";

/*
 * Decisions for the email links that establish a session: sign-up confirmation and invitation. The link carries a one-time token hash
 * and a type. The route exchanges it on the server, and this module decides what the visitor sees next. It holds no secrets and reads
 * no environment, so it can be tested on its own. Results are short codes, never free text, so they are safe to log and to put in a URL.
 */

export const CONFIRM_TYPES = ["signup", "invite"] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export type ConfirmFailure = "expired" | "invalid";

// A token hash is URL-safe. The bounds keep an obviously malformed value away from the auth server.
const TOKEN_HASH = /^[A-Za-z0-9_.-]{16,256}$/;

export function confirmTypeFrom(value: string | null): ConfirmType | null {
  return (CONFIRM_TYPES as readonly string[]).includes(value ?? "") ? (value as ConfirmType) : null;
}

export function tokenHashFrom(value: string | null): string | null {
  return value !== null && TOKEN_HASH.test(value) ? value : null;
}

/** An expired link and a link that was already used both report "otp_expired". Anything else is treated as invalid. */
export function confirmFailureFrom(code: string | undefined): ConfirmFailure {
  return code === "otp_expired" ? "expired" : "invalid";
}

/** Supabase's global sign-up switch reports "signup_disabled". Every other refusal keeps the generic message. */
export function signUpRefusalFrom(code: string | undefined): "invitationOnly" | "generic" {
  return code === "signup_disabled" ? "invitationOnly" : "generic";
}

/**
 * Where a confirmed visitor goes. An invitation must set a password first. A confirmed sign-up without a profile goes to profile setup,
 * with a short confirmation notice. The destination is always a path on this site: the requested path passes safeNextPath, and nothing
 * else in the link is used as a redirect target.
 */
export function destinationAfterConfirm(input: {
  readonly type: ConfirmType;
  readonly next: string | null;
  readonly hasProfile: boolean;
}): string {
  const next = safeNextPath(input.next, "/");
  if (input.type === "invite") {
    return `/auth/set-password?next=${encodeURIComponent(next)}`;
  }
  if (!input.hasProfile) {
    return `/profile/setup?next=${encodeURIComponent(next)}&confirmed=1`;
  }
  return next;
}
