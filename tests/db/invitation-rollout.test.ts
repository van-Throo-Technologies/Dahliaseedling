import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { anonClient, errorCode, withSuperuser } from "../support/local-supabase";
import { proofFor } from "../support/invitation-intake";

/*
 * Rollout compatibility. The application already deployed calls the five-argument submission function, which knows no visitor. The new
 * application calls the seven-argument function. Both must work at once, and both must be limited. The five-argument call shares one
 * hourly allowance of 100, which is the hash of the text "legacy-submissions", kept in the migration.
 */

const LEGACY_HASH = createHash("sha256").update("legacy-submissions").digest("hex");
const emails: string[] = [];

function address(label: string): string {
  const email = `rollout-${label}-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  return email;
}

function legacy(email: string, clientKey = crypto.randomUUID()) {
  return {
    p_client_key: clientKey,
    p_name: "Anna de Vries",
    p_country: "NL",
    p_email: email,
    p_reason: "I grow dahlias from seed and want to share real plants.",
  };
}

function current(email: string, visitor: string, limit = 100) {
  const clientKey = crypto.randomUUID();
  return {
    ...legacy(email, clientKey),
    p_visitor_hash: visitor,
    p_visitor_limit: limit,
    p_proof: proofFor(visitor, limit, clientKey),
  };
}

async function storedRows(email: string) {
  return withSuperuser(async (db) => {
    const { rows } = await db.query("select id from public.invitation_requests where email = $1", [
      email,
    ]);
    return rows;
  });
}

async function bucket(hash: string) {
  return withSuperuser(async (db) => {
    const { rows } = await db.query(
      "select submissions, refused from public.invitation_visitor_buckets where visitor_hash = $1 and window_start = date_trunc('hour', now())",
      [hash],
    );
    return rows;
  });
}

async function setLegacyBucket(submissions: number, refused: number) {
  await withSuperuser(async (db) => {
    await db.query(
      `insert into public.invitation_visitor_buckets (visitor_hash, window_start, submissions, refused)
       values ($1, date_trunc('hour', now()), $2, $3)
       on conflict (visitor_hash, window_start) do update set submissions = excluded.submissions, refused = excluded.refused`,
      [LEGACY_HASH, submissions, refused],
    );
  });
}

afterAll(async () => {
  await withSuperuser(async (db) => {
    await db.query("delete from public.invitation_visitor_buckets where visitor_hash = $1", [
      LEGACY_HASH,
    ]);
    await db.query("delete from public.invitation_requests where email = any($1::text[])", [
      emails,
    ]);
  });
});

describe("both submission signatures exist with the intended grants", () => {
  it("has the five-argument rollout wrapper and the seven-argument function, each executable by visitors only", async () => {
    const found = await withSuperuser(async (db) => {
      const { rows } = await db.query(
        `select pg_get_function_identity_arguments(p.oid) as args,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
                has_function_privilege('public', p.oid, 'EXECUTE') as public_grant
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'submit_invitation_request'
          order by 1`,
      );
      return rows;
    });
    expect(found).toEqual([
      {
        args: "p_client_key uuid, p_name text, p_country text, p_email text, p_reason text",
        anon: true,
        authenticated: true,
        public_grant: false,
      },
      {
        args: "p_client_key uuid, p_name text, p_country text, p_email text, p_reason text, p_visitor_hash text, p_visitor_limit integer, p_proof text",
        anon: true,
        authenticated: true,
        public_grant: false,
      },
    ]);
  });
});

describe("the deployed five-argument call keeps working during rollout", () => {
  it("stores a request and answers received, as the deployed application expects", async () => {
    const email = address("deployed");
    const { data, error } = await anonClient().rpc("submit_invitation_request", legacy(email));
    expect(error).toBeNull();
    expect(data).toBe("received");
    expect(await storedRows(email)).toHaveLength(1);
  });

  it("answers a repeat with the same client key as received, and stores it once", async () => {
    const email = address("deployed-repeat");
    const clientKey = crypto.randomUUID();
    const first = await anonClient().rpc("submit_invitation_request", legacy(email, clientKey));
    const second = await anonClient().rpc("submit_invitation_request", legacy(email, clientKey));
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.data).toBe("received");
    expect(await storedRows(email)).toHaveLength(1);
  });

  it("is refused with an error once the shared legacy allowance is used, and stores nothing", async () => {
    await setLegacyBucket(100, 0);
    const email = address("deployed-over");
    const { error } = await anonClient().rpc("submit_invitation_request", legacy(email));
    expect(errorCode(error)).toBe("P0001");
    expect(await storedRows(email)).toHaveLength(0);
    // The refusal is raised as an error, so the transaction, including its counter increment, is rolled back. The allowance still holds at
    // 100. The cost is that a legacy refusal is not counted on the activity page.
    expect(await bucket(LEGACY_HASH)).toEqual([{ submissions: 100, refused: 0 }]);
  });

  it("counts its requests only against the shared legacy bucket, never a visitor's own", async () => {
    await setLegacyBucket(0, 0);
    const visitor = createHash("sha256").update(crypto.randomUUID()).digest("hex");
    const { error } = await anonClient().rpc(
      "submit_invitation_request",
      legacy(address("separate")),
    );
    expect(error).toBeNull();
    expect(await bucket(visitor)).toEqual([]);
    expect(await bucket(LEGACY_HASH)).toEqual([{ submissions: 1, refused: 0 }]);
  });
});

describe("the new seven-argument call still enforces the per-visitor limit", () => {
  it("refuses a visitor past their allowance while the deployed call is also in use", async () => {
    await setLegacyBucket(0, 0);
    const visitor = createHash("sha256").update(crypto.randomUUID()).digest("hex");
    const first = await anonClient().rpc(
      "submit_invitation_request",
      current(address("new-a"), visitor, 1),
    );
    expect(first.data).toBe("received");
    const second = await anonClient().rpc(
      "submit_invitation_request",
      current(address("new-b"), visitor, 1),
    );
    expect(second.data).toBe("visitor_limited");
    expect(await bucket(visitor)).toEqual([{ submissions: 2, refused: 1 }]);
  });
});
