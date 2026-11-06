import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { anonClient, errorCode, withSuperuser } from "../support/local-supabase";
import { proofFor } from "../support/invitation-intake";
import { intakeProof } from "../../src/modules/invitations/visitor";

/*
 * Negative tests: a direct caller of the database cannot choose its visitor or its allowance, cannot forge or reuse a proof, and cannot
 * submit at all while no intake key is configured. Each refusal is checked for its code, and for no change to the request or the counter.
 */

const emails: string[] = [];
const hashes: string[] = [];

function address(label: string): string {
  const email = `intake-${label}-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  return email;
}

function freshHash(): string {
  const hash = createHash("sha256").update(crypto.randomUUID()).digest("hex");
  hashes.push(hash);
  return hash;
}

function request(
  email: string,
  clientKey: string,
  visitor: string,
  limit: number,
  proof: string | null,
) {
  return {
    p_client_key: clientKey,
    p_name: "Anna de Vries",
    p_country: "NL",
    p_email: email,
    p_reason: "I grow dahlias from seed and want to share real plants.",
    p_visitor_hash: visitor,
    p_visitor_limit: limit,
    p_proof: proof,
  };
}

async function storedRows(email: string): Promise<number> {
  return withSuperuser(async (db) => {
    const { rows } = await db.query("select id from public.invitation_requests where email = $1", [
      email,
    ]);
    return rows.length;
  });
}

async function counter(visitor: string) {
  return withSuperuser(async (db) => {
    const { rows } = await db.query(
      "select submissions, refused from public.invitation_visitor_buckets where visitor_hash = $1",
      [visitor],
    );
    return rows;
  });
}

async function withoutKey<T>(run: () => Promise<T>): Promise<T> {
  const saved = await withSuperuser(async (db) => {
    const { rows } = await db.query(
      "select secret from private.invitation_intake_keys where id = 1",
    );
    await db.query("delete from private.invitation_intake_keys where id = 1");
    return rows[0]?.secret as string | undefined;
  });
  try {
    return await run();
  } finally {
    await withSuperuser(async (db) => {
      if (saved !== undefined) {
        await db.query(
          "insert into private.invitation_intake_keys (id, secret) values (1, $1) on conflict (id) do update set secret = excluded.secret",
          [saved],
        );
      }
    });
  }
}

afterAll(async () => {
  await withSuperuser(async (db) => {
    await db.query("delete from public.invitation_requests where email = any($1::text[])", [
      emails,
    ]);
    await db.query(
      "delete from public.invitation_visitor_buckets where visitor_hash = any($1::text[])",
      [hashes],
    );
  });
});

describe("a direct caller cannot choose its visitor", () => {
  it("refuses a call with no proof, and stores nothing", async () => {
    const visitor = freshHash();
    const email = address("no-proof");
    const clientKey = crypto.randomUUID();
    const { error } = await anonClient().rpc(
      "submit_invitation_request",
      request(email, clientKey, visitor, 10, null),
    );
    expect(errorCode(error)).toBe("42501");
    expect(await storedRows(email)).toBe(0);
    expect(await counter(visitor)).toEqual([]);
  });

  it("refuses a proof made with a guessed key, including over many fresh visitors", async () => {
    const guessed = "guessed-by-an-outsider-0123456789abcdef";
    const email = address("guessed");
    let refusals = 0;
    for (let index = 0; index < 15; index += 1) {
      const visitor = freshHash();
      const clientKey = crypto.randomUUID();
      const proof = intakeProof(visitor, 1, clientKey, guessed);
      const { error, data } = await anonClient().rpc(
        "submit_invitation_request",
        request(address(`rotate-${index}`), clientKey, visitor, 1, proof),
      );
      if (errorCode(error) === "42501") refusals += 1;
      expect(data).toBeNull();
    }
    expect(refusals).toBe(15);
    expect(await storedRows(email)).toBe(0);
  });

  it("refuses a request whose allowance was raised after signing", async () => {
    const visitor = freshHash();
    const clientKey = crypto.randomUUID();
    const signedForOne = proofFor(visitor, 1, clientKey);
    const { error } = await anonClient().rpc(
      "submit_invitation_request",
      request(address("raised"), clientKey, visitor, 100, signedForOne),
    );
    expect(errorCode(error)).toBe("42501");
    expect(await counter(visitor)).toEqual([]);
  });

  it("refuses a proof reused for another visitor", async () => {
    const signedFor = freshHash();
    const other = freshHash();
    const clientKey = crypto.randomUUID();
    const { error } = await anonClient().rpc(
      "submit_invitation_request",
      request(address("other-visitor"), clientKey, other, 10, proofFor(signedFor, 10, clientKey)),
    );
    expect(errorCode(error)).toBe("42501");
    expect(await counter(other)).toEqual([]);
  });

  it("refuses a proof reused for another client key", async () => {
    const visitor = freshHash();
    const signedKey = crypto.randomUUID();
    const { error } = await anonClient().rpc(
      "submit_invitation_request",
      request(
        address("other-key"),
        crypto.randomUUID(),
        visitor,
        10,
        proofFor(visitor, 10, signedKey),
      ),
    );
    expect(errorCode(error)).toBe("42501");
  });
});

describe("a correctly signed request is counted and limited", () => {
  it("is accepted up to the signed allowance, and refused beyond it", async () => {
    const visitor = freshHash();
    const results: Array<string | null> = [];
    for (let index = 0; index < 3; index += 1) {
      const clientKey = crypto.randomUUID();
      const { data, error } = await anonClient().rpc(
        "submit_invitation_request",
        request(address(`signed-${index}`), clientKey, visitor, 2, proofFor(visitor, 2, clientKey)),
      );
      expect(error).toBeNull();
      results.push(data);
    }
    expect(results).toEqual(["received", "received", "visitor_limited"]);
    expect(await counter(visitor)).toEqual([{ submissions: 3, refused: 1 }]);
  });
});

describe("the request fails closed without an intake key", () => {
  it("refuses a correctly signed request while no key is configured, and stores nothing", async () => {
    const visitor = freshHash();
    const email = address("no-key");
    const clientKey = crypto.randomUUID();
    const { error } = await withoutKey(
      async () =>
        await anonClient().rpc(
          "submit_invitation_request",
          request(email, clientKey, visitor, 10, proofFor(visitor, 10, clientKey)),
        ),
    );
    expect(errorCode(error)).toBe("55000");
    expect(await storedRows(email)).toBe(0);
    expect(await counter(visitor)).toEqual([]);
  });

  it("accepts a correctly signed request again once the key is restored", async () => {
    const visitor = freshHash();
    const clientKey = crypto.randomUUID();
    const { data, error } = await anonClient().rpc(
      "submit_invitation_request",
      request(address("key-back"), clientKey, visitor, 10, proofFor(visitor, 10, clientKey)),
    );
    expect(error).toBeNull();
    expect(data).toBe("received");
  });
});

describe("the key and the counting functions are not reachable by clients", () => {
  it("gives clients no privilege on the private schema, its key table or its functions", async () => {
    const [grants] = await withSuperuser(async (db) => {
      const { rows } = await db.query(
        `select
           has_schema_privilege('anon', 'private', 'USAGE') as anon_schema,
           has_schema_privilege('authenticated', 'private', 'USAGE') as authenticated_schema,
           has_table_privilege('anon', 'private.invitation_intake_keys', 'SELECT') as anon_key,
           has_table_privilege('authenticated', 'private.invitation_intake_keys', 'SELECT') as authenticated_key,
           has_function_privilege('anon', 'private.accept_invitation_request(uuid,text,text,text,text,text,integer)', 'EXECUTE') as anon_accept,
           has_function_privilege('authenticated', 'private.accept_invitation_request(uuid,text,text,text,text,text,integer)', 'EXECUTE') as authenticated_accept`,
      );
      return rows;
    });
    expect(grants).toEqual({
      anon_schema: false,
      authenticated_schema: false,
      anon_key: false,
      authenticated_key: false,
      anon_accept: false,
      authenticated_accept: false,
    });
  });

  it("has no seven-argument overload, which accepted a visitor and allowance from any caller", async () => {
    const [{ n }] = await withSuperuser(async (db) => {
      const { rows } = await db.query(
        "select count(*)::int as n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'public' and p.proname = 'submit_invitation_request' and p.pronargs = 7",
      );
      return rows;
    });
    expect(n).toBe(0);
  });

  it("refuses the legacy wrapper when a caller tries to name a visitor", async () => {
    const visitor = freshHash();
    const email = address("legacy-named");
    const { error } = await anonClient().rpc("submit_invitation_request", {
      p_client_key: crypto.randomUUID(),
      p_name: "Anna de Vries",
      p_country: "NL",
      p_email: email,
      p_reason: "I grow dahlias from seed and want to share real plants.",
      p_visitor_hash: visitor,
    });
    expect(error).not.toBeNull();
    expect(await storedRows(email)).toBe(0);
    expect(await counter(visitor)).toEqual([]);
  });
});
