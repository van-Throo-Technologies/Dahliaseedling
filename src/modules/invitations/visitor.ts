import { createHmac } from "node:crypto";

/*
 * The per-visitor limit for invitation requests. A visitor is identified only by a keyed hash of their network address, so no raw address
 * is stored, logged or sent to the database.
 *
 * Which address counts: the LAST entry of x-forwarded-for. On Vercel the platform appends the address it accepted the connection from, so
 * that entry is the one the client cannot choose. Earlier entries come from the client and are never trusted. x-real-ip is deliberately
 * not used: a client can send it, and nothing in this code shows that the platform overwrites it.
 *
 * Revalidate on any other host: confirm that the last x-forwarded-for entry is the connecting address there, by sending a request with a
 * forged leading entry and checking that the visitor's count does not change. When no address is present, every such request shares one
 * bucket, so the limit still applies.
 *
 * Shared addresses: many visitors on one mobile network or office connection share an address, so a limit per address also limits them
 * together. The default allowance is deliberately generous for that reason.
 */

export const VISITOR_LIMIT_DEFAULT = 10;
export const VISITOR_LIMIT_MAX = 100;

/** The connecting address the platform appended to x-forwarded-for, or null when no address is present. */
export function visitorAddress(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const last = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .pop();
  return last ?? null;
}

/**
 * A keyed hash of the address, with the secret salt. The same visitor gets the same value while the salt is unchanged. Rotating the salt
 * starts every count again, which is the intended way to reset the limits.
 */
export function visitorHash(address: string | null, salt: string): string {
  return createHmac("sha256", salt)
    .update(address ?? "unknown")
    .digest("hex");
}

/**
 * The proof the database requires for a submission. It covers the visitor hash, the allowance and the client key, in that order, so
 * changing any of them invalidates it. The server computes it with the intake key, which the database also holds. A caller without that
 * key cannot produce one, so it cannot choose its own visitor or allowance.
 */
export function intakeProof(
  visitor: string,
  limit: number,
  clientKey: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${visitor}|${limit}|${clientKey.toLowerCase()}`)
    .digest("hex");
}

/** The configured hourly allowance, from INVITATION_VISITOR_HOURLY_LIMIT. Anything unusable falls back to the default. */
export function visitorLimitFrom(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > VISITOR_LIMIT_MAX)
    return VISITOR_LIMIT_DEFAULT;
  return parsed;
}
