import { createHash } from "node:crypto";

/*
 * A brake on guessing the staging testing password: after too many wrong attempts from one visitor address, the gate refuses further
 * attempts for a while. The counts live in the memory of one server instance. On a serverless platform each instance keeps its own
 * counts, so this slows guessing but does not guarantee a limit. The real protection is the password's length. Only a hash of each
 * address is kept, and a count clears itself when its window ends.
 */

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 10;
const MAX_TRACKED_ADDRESSES = 5000;

interface Attempts {
  readonly count: number;
  readonly windowStart: number;
}

const failures = new Map<string, Attempts>();

function keyFor(address: string): string {
  return createHash("sha256").update(address).digest("base64url");
}

function windowOpen(entry: Attempts, nowSeconds: number): boolean {
  return nowSeconds - entry.windowStart < WINDOW_SECONDS;
}

/** Keeps the map bounded: expired entries go first, then the oldest, so a flood of addresses cannot grow memory without limit. */
function makeRoom(nowSeconds: number): void {
  if (failures.size < MAX_TRACKED_ADDRESSES) return;
  for (const [key, entry] of failures) {
    if (!windowOpen(entry, nowSeconds)) failures.delete(key);
  }
  if (failures.size >= MAX_TRACKED_ADDRESSES) {
    const oldest = failures.keys().next().value;
    if (oldest !== undefined) failures.delete(oldest);
  }
}

export function isAttemptLimited(address: string, nowSeconds: number): boolean {
  const key = keyFor(address);
  const entry = failures.get(key);
  if (!entry) return false;
  if (!windowOpen(entry, nowSeconds)) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordFailedAttempt(address: string, nowSeconds: number): void {
  const key = keyFor(address);
  const entry = failures.get(key);
  if (entry && windowOpen(entry, nowSeconds)) {
    failures.set(key, { count: entry.count + 1, windowStart: entry.windowStart });
    return;
  }
  makeRoom(nowSeconds);
  failures.set(key, { count: 1, windowStart: nowSeconds });
}

/** A correct password clears the count for that address. */
export function clearAttempts(address: string): void {
  failures.delete(keyFor(address));
}

export const STAGING_ATTEMPT_LIMITS = { windowSeconds: WINDOW_SECONDS, maxFailures: MAX_FAILURES };
