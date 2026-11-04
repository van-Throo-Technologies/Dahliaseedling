/*
 * The database refuses a write over its limit with SQLSTATE 53400 (see the Phase 10A abuse-limit migration). The message is the same
 * for every limited action, so one check serves them all. The text of the database error is never shown to a grower.
 */

export const RATE_LIMITED_CODE = "53400";

export function isRateLimited(error: { code?: string } | null | undefined): boolean {
  return error?.code === RATE_LIMITED_CODE;
}
