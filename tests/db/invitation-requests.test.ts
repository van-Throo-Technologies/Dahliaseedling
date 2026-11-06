import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Founder-controlled invitation requests. A visitor's request is stored as pending and creates no account. Only an administrator can read
 * or decide a request, and each approval and sent-record happens once. The public answer is the same for a new request and a repeat.
 */

const created: string[] = [];
const emails: string[] = [];
let admin: TestUser;
let grower: TestUser;

function address(label: string): string {
  const email = `ir-${label}-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  return email;
}

function submission(email: string, clientKey = crypto.randomUUID()) {
  return {
    p_client_key: clientKey,
    p_name: "Anna de Vries",
    p_country: "NL",
    p_email: email,
    p_reason: "I grow dahlias from seed and want to share real plants.",
  };
}

async function requestRow(email: string) {
  return withSuperuser(async (db) => {
    const { rows } = await db.query(
      "select id, status, decided_at, invited_at from public.invitation_requests where email = $1",
      [email],
    );
    return rows;
  });
}

beforeAll(async () => {
  admin = await createTestUser("ir-admin");
  grower = await createTestUser("ir-grower");
  created.push(admin.id, grower.id);
  await withSuperuser((db) =>
    db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]),
  );
});

afterAll(async () => {
  await withSuperuser((db) =>
    db.query("delete from public.invitation_requests where email = any($1::text[])", [emails]),
  );
  await removeTestUsers(created);
});

describe("public submission", () => {
  it("stores a new request as pending, and creates no account for the applicant", async () => {
    const email = address("new");
    const result = await anonClient().rpc("submit_invitation_request", submission(email));
    expect(result.error).toBeNull();
    expect(result.data).toBe("received");

    const [row] = await requestRow(email);
    expect(row.status).toBe("pending");

    const accounts = await withSuperuser(
      async (db) =>
        (await db.query("select count(*)::int as n from auth.users where email = $1", [email]))
          .rows[0],
    );
    expect(accounts.n).toBe(0);
  });

  it("answers a repeat with the same client key the same way, and stores it once", async () => {
    const email = address("repeat-key");
    const key = crypto.randomUUID();
    expect((await anonClient().rpc("submit_invitation_request", submission(email, key))).data).toBe(
      "received",
    );
    expect((await anonClient().rpc("submit_invitation_request", submission(email, key))).data).toBe(
      "received",
    );
    expect(await requestRow(email)).toHaveLength(1);
  });

  it("answers a second open request for the same address as a new one, without storing it", async () => {
    const email = address("open-twice");
    expect((await anonClient().rpc("submit_invitation_request", submission(email))).data).toBe(
      "received",
    );
    const second = await anonClient().rpc("submit_invitation_request", submission(email));
    expect(second.data).toBe("received");
    expect(await requestRow(email)).toHaveLength(1);
  });

  it("refuses an invalid request with a validation error and stores nothing", async () => {
    const email = address("invalid");
    const result = await anonClient().rpc("submit_invitation_request", {
      ...submission(email),
      p_country: "XX1",
    });
    expect(errorCode(result.error)).toBe("22023");
    expect(await requestRow(email)).toHaveLength(0);
  });

  it("reports limited, and stores nothing, once the daily cap is reached", async () => {
    const batch = Array.from({ length: 200 }, (_, index) => ({
      email: `ir-cap-${index}-${crypto.randomUUID()}@example.test`,
      key: crypto.randomUUID(),
    }));
    await withSuperuser((db) =>
      db.query(
        `insert into public.invitation_requests (client_key, name, country_code, email, reason)
         select (x->>'key')::uuid, 'Cap Test', 'NL', x->>'email', 'A reason of enough length.'
           from jsonb_array_elements($1::jsonb) as x`,
        [JSON.stringify(batch)],
      ),
    );
    emails.push(...batch.map((row) => row.email));
    try {
      const email = address("over-cap");
      const result = await anonClient().rpc("submit_invitation_request", submission(email));
      expect(result.data).toBe("limited");
      expect(await requestRow(email)).toHaveLength(0);
    } finally {
      await withSuperuser((db) =>
        db.query("delete from public.invitation_requests where email = any($1::text[])", [
          batch.map((row) => row.email),
        ]),
      );
    }
  });
});

describe("administrator review", () => {
  it("lets an administrator list pending requests, and refuses everyone else", async () => {
    const email = address("listed");
    await anonClient().rpc("submit_invitation_request", submission(email));

    const asAdmin = await admin.client.rpc("admin_list_invitation_requests", {
      p_status: "pending",
      p_limit: 100,
    });
    expect(asAdmin.error).toBeNull();
    expect((asAdmin.data as { email: string }[]).some((row) => row.email === email)).toBe(true);

    const asGrower = await grower.client.rpc("admin_list_invitation_requests", {
      p_status: "pending",
    });
    expect(errorCode(asGrower.error)).toBe("42501");
    const asVisitor = await anonClient().rpc("admin_list_invitation_requests", {
      p_status: "pending",
    });
    expect(asVisitor.error).not.toBeNull();
  });

  it("refuses a decision from a non-administrator, and changes nothing", async () => {
    const email = address("not-decided");
    await anonClient().rpc("submit_invitation_request", submission(email));
    const [row] = await requestRow(email);

    const result = await grower.client.rpc("admin_decide_invitation_request", {
      p_request_id: row.id,
      p_decision: "approve",
    });
    expect(errorCode(result.error)).toBe("42501");
    expect((await requestRow(email))[0].status).toBe("pending");
  });

  it("approves a pending request once, and a second decision changes nothing", async () => {
    const email = address("approve-once");
    await anonClient().rpc("submit_invitation_request", submission(email));
    const [row] = await requestRow(email);

    const first = await admin.client.rpc("admin_decide_invitation_request", {
      p_request_id: row.id,
      p_decision: "approve",
    });
    expect(first.data).toBe("approved");
    const second = await admin.client.rpc("admin_decide_invitation_request", {
      p_request_id: row.id,
      p_decision: "decline",
    });
    expect(errorCode(second.error)).toBe("55000");
    expect((await requestRow(email))[0].status).toBe("approved");
  });

  it("declines a pending request, and reports an unknown request as not found", async () => {
    const email = address("decline");
    await anonClient().rpc("submit_invitation_request", submission(email));
    const [row] = await requestRow(email);
    expect(
      (
        await admin.client.rpc("admin_decide_invitation_request", {
          p_request_id: row.id,
          p_decision: "decline",
        })
      ).data,
    ).toBe("declined");

    const missing = await admin.client.rpc("admin_decide_invitation_request", {
      p_request_id: crypto.randomUUID(),
      p_decision: "approve",
    });
    expect(errorCode(missing.error)).toBe("P0002");
  });

  it("records a sent invitation once, and only for an approved request", async () => {
    const email = address("sent");
    await anonClient().rpc("submit_invitation_request", submission(email));
    const [row] = await requestRow(email);

    const beforeApproval = await admin.client.rpc("admin_mark_invitation_sent", {
      p_request_id: row.id,
    });
    expect(errorCode(beforeApproval.error)).toBe("55000");

    await admin.client.rpc("admin_decide_invitation_request", {
      p_request_id: row.id,
      p_decision: "approve",
    });
    expect(
      (await admin.client.rpc("admin_mark_invitation_sent", { p_request_id: row.id })).error,
    ).toBeNull();
    const [after] = await requestRow(email);
    expect(after.status).toBe("invited");
    expect(after.invited_at).not.toBeNull();

    const again = await admin.client.rpc("admin_mark_invitation_sent", { p_request_id: row.id });
    expect(errorCode(again.error)).toBe("55000");
  });
});

describe("data protection", () => {
  it("keeps the table unreadable and unwritable by clients", async () => {
    const [grants] = await withSuperuser(
      async (db) =>
        (
          await db.query(
            `select has_table_privilege('anon', 'public.invitation_requests', 'SELECT,INSERT,UPDATE,DELETE') as anon,
                  has_table_privilege('authenticated', 'public.invitation_requests', 'SELECT,INSERT,UPDATE,DELETE') as authenticated,
                  relrowsecurity as rls
             from pg_class where oid = 'public.invitation_requests'::regclass`,
          )
        ).rows,
    );
    expect(grants).toEqual({ anon: false, authenticated: false, rls: true });

    const read = await admin.client.from("invitation_requests").select("id");
    expect(read.data ?? []).toEqual([]);
  });

  it("refuses a retention period below 30 days, and removes only finished requests past it", async () => {
    const refused = await admin.client.rpc("admin_purge_invitation_requests", {
      p_older_than: "7 days",
    });
    expect(errorCode(refused.error)).toBe("22023");

    const oldEmail = address("old-declined");
    const pendingEmail = address("old-pending");
    await withSuperuser((db) =>
      db.query(
        `insert into public.invitation_requests (client_key, name, country_code, email, reason, status, created_at, decided_at)
         values ($1, 'Old Request', 'NL', $2, 'A reason of enough length.', 'declined', now() - interval '200 days', now() - interval '200 days'),
                ($3, 'Open Request', 'NL', $4, 'A reason of enough length.', 'pending', now() - interval '200 days', null)`,
        [crypto.randomUUID(), oldEmail, crypto.randomUUID(), pendingEmail],
      ),
    );

    const removed = await admin.client.rpc("admin_purge_invitation_requests", {
      p_older_than: "90 days",
    });
    expect(removed.error).toBeNull();
    expect(removed.data).toBeGreaterThanOrEqual(1);
    expect(await requestRow(oldEmail)).toHaveLength(0);
    expect(await requestRow(pendingEmail)).toHaveLength(1);
  });
});
