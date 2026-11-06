import { randomBytes } from "node:crypto";
import { intakeProof } from "../../src/modules/invitations/visitor";
import { withSuperuser } from "./local-supabase";

/*
 * Test-only. Each test process gets its own random intake key. The key is written to the local database before the tests run, and the
 * Playwright configuration passes it to the server. It is never written to disk, and these helpers must never run against a hosted project.
 */

export const intakeSecret =
  process.env.INVITATION_INTAKE_SECRET?.trim() || randomBytes(32).toString("hex");

/** Writes this process's intake key into the local database, replacing any earlier one. */
export async function installIntakeKey(): Promise<void> {
  await withSuperuser(async (db) => {
    await db.query(
      `insert into private.invitation_intake_keys (id, secret) values (1, $1)
       on conflict (id) do update set secret = excluded.secret`,
      [intakeSecret],
    );
  });
}

/** The proof the server would send for these values, so tests can make correctly signed calls and forged ones. */
export function proofFor(visitor: string, limit: number, clientKey: string): string {
  return intakeProof(visitor, limit, clientKey, intakeSecret);
}
