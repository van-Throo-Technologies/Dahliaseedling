import { afterAll, describe, expect, it } from "vitest";
import { anonClient, errorCode, withSuperuser } from "../support/local-supabase";
import { proofFor } from "../support/invitation-intake";

/*
 * After the rollout, the legacy five-argument submission route is closed. The eight-argument function remains reachable by visitors, and
 * it still refuses any call without a server-signed proof. These tests cover the closure and the reachability of the new route.
 */

const emails: string[] = [];

function address(label: string): string {
  const email = `rollout-${label}-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  return email;
}

function legacy(email: string) {
  return {
    p_client_key: crypto.randomUUID(),
    p_name: "Anna de Vries",
    p_country: "NL",
    p_email: email,
    p_reason: "I grow dahlias from seed and want to share real plants.",
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

afterAll(async () => {
  await withSuperuser(async (db) => {
    await db.query("delete from public.invitation_requests where email = any($1::text[])", [
      emails,
    ]);
  });
});

describe("the legacy five-argument route is closed", () => {
  it("refuses an anonymous call and stores nothing", async () => {
    const email = address("legacy-anon");
    const { error } = await anonClient().rpc("submit_invitation_request", legacy(email));
    expect(errorCode(error)).toBe("42501");
    expect(await storedRows(email)).toBe(0);
  });

  it("has no execute grant for visitors or PUBLIC", async () => {
    const [grants] = await withSuperuser(async (db) => {
      const { rows } = await db.query(
        `select
           has_function_privilege('anon', 'public.submit_invitation_request(uuid,text,text,text,text)', 'EXECUTE') as anon,
           has_function_privilege('authenticated', 'public.submit_invitation_request(uuid,text,text,text,text)', 'EXECUTE') as authenticated,
           has_function_privilege('public', 'public.submit_invitation_request(uuid,text,text,text,text)', 'EXECUTE') as public_grant`,
      );
      return rows;
    });
    expect(grants).toEqual({ anon: false, authenticated: false, public_grant: false });
  });
});

describe("the eight-argument route remains reachable and still needs a proof", () => {
  it("is reachable by visitors, and refuses a call without a valid proof", async () => {
    const email = address("eight-no-proof");
    const { error } = await anonClient().rpc("submit_invitation_request", {
      ...legacy(email),
      p_visitor_hash: "a".repeat(64),
      p_visitor_limit: 10,
      p_proof: null,
    });
    // A grant error would be 42501 with a permission message. The refusal here comes from the proof check.
    expect(errorCode(error)).toBe("42501");
    expect(error?.message).toBe("invalid intake proof");
    expect(await storedRows(email)).toBe(0);
  });

  it("refuses a forged proof, so the route cannot be used without the server's key", async () => {
    const email = address("eight-forged");
    const visitor = "b".repeat(64);
    const clientKey = crypto.randomUUID();
    const forged = proofFor(visitor, 10, clientKey).replace(/^./, (c) => (c === "0" ? "1" : "0"));
    const { error } = await anonClient().rpc("submit_invitation_request", {
      ...legacy(email),
      p_client_key: clientKey,
      p_visitor_hash: visitor,
      p_visitor_limit: 10,
      p_proof: forged,
    });
    expect(error?.message).toBe("invalid intake proof");
    expect(await storedRows(email)).toBe(0);
  });
});
