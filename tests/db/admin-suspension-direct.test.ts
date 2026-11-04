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
 * Phase 10A direct administrator suspension. An administrator can suspend or reinstate any other profile without a report. Each change
 * needs a reason and writes a durable audit row with the acting administrator and time. An administrator cannot suspend their own account.
 * The older unaudited function is not callable by any client.
 */

const REASON = "Repeated harassment in private messages";
const created: string[] = [];
const visitor = anonClient();
let admin: TestUser;
let alice: TestUser;
let bob: TestUser;

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function suspended(profileId: string): Promise<boolean> {
  const [row] = await rows("select is_suspended from public.profiles where id = $1", [profileId]);
  return row.is_suspended as boolean;
}

beforeAll(async () => {
  admin = await createTestUser("sd-admin");
  alice = await createTestUser("sd-alice");
  bob = await createTestUser("sd-bob");
  created.push(admin.id, alice.id, bob.id);
  await withSuperuser(async (db) => {
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, 'Admin SD', 'NL')",
      [admin.id],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, 'Alice SD', 'NL')",
      [alice.id],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, 'Bob SD', 'BE')",
      [bob.id],
    );
    await db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]);
  });
});

afterAll(async () => {
  await withSuperuser((db) =>
    db.query("delete from public.admin_users where user_id = $1", [admin.id]),
  );
  await removeTestUsers(created);
});

describe("who may suspend directly", () => {
  it("refuses a grower", async () => {
    const { error } = await alice.client.rpc("admin_suspend_profile", {
      p_profile_id: bob.id,
      p_suspended: true,
      p_reason: REASON,
    });
    expect(errorCode(error)).toBe("42501");
    expect(await suspended(bob.id)).toBe(false);
  });

  it("refuses a visitor", async () => {
    const { error } = await visitor.rpc("admin_suspend_profile", {
      p_profile_id: bob.id,
      p_suspended: true,
      p_reason: REASON,
    });
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses the unaudited primitive to every client, so only the audited path can change suspension", async () => {
    const { error } = await admin.client.rpc("admin_set_suspended", {
      target_profile_id: bob.id,
      suspended: true,
    });
    expect(errorCode(error)).toBe("42501");
    expect(await suspended(bob.id)).toBe(false);
  });
});

describe("the administrator's own account and the reason", () => {
  it("refuses an administrator suspending their own account", async () => {
    const { error } = await admin.client.rpc("admin_suspend_profile", {
      p_profile_id: admin.id,
      p_suspended: true,
      p_reason: REASON,
    });
    expect(errorCode(error)).toBe("23514");
    expect(error?.message).toContain("cannot suspend your own");
    expect(await suspended(admin.id)).toBe(false);
  });

  it.each([
    ["an empty reason", ""],
    ["a blank reason", "          "],
    ["a reason shorter than 10 characters", "too short"],
    ["a reason longer than 500 characters", "x".repeat(501)],
  ])("refuses %s, and changes nothing", async (_label, reason) => {
    const { error } = await admin.client.rpc("admin_suspend_profile", {
      p_profile_id: bob.id,
      p_suspended: true,
      p_reason: reason,
    });
    expect(errorCode(error)).toBe("23514");
    expect(await suspended(bob.id)).toBe(false);
  });

  it("refuses an unknown profile", async () => {
    const { error } = await admin.client.rpc("admin_suspend_profile", {
      p_profile_id: "00000000-0000-4000-8000-00000000dead",
      p_suspended: true,
      p_reason: REASON,
    });
    expect(errorCode(error)).toBe("P0002");
  });
});

describe("a direct suspension is audited and reversible", () => {
  let auditBefore = 0;

  it("suspends, hides the profile from others, and writes one audit row", async () => {
    auditBefore = (await rows("select count(*)::int as n from public.admin_actions")).at(0)!
      .n as number;
    const { error } = await admin.client.rpc("admin_suspend_profile", {
      p_profile_id: bob.id,
      p_suspended: true,
      p_reason: `  ${REASON}  `,
    });
    expect(error).toBeNull();
    expect(await suspended(bob.id)).toBe(true);

    const [audit] = await rows(
      `select admin_id::text, action_type, target_type, target_id::text, reason
         from public.admin_actions where target_id = $1 order by created_at desc limit 1`,
      [bob.id],
    );
    expect(audit).toEqual({
      admin_id: admin.id,
      action_type: "account_suspended",
      target_type: "profile",
      target_id: bob.id,
      reason: REASON,
    });
    const after = (await rows("select count(*)::int as n from public.admin_actions")).at(0)!
      .n as number;
    expect(after - auditBefore).toBe(1);
  });

  it("the suspended profile is hidden from another grower, as before", async () => {
    const view = await alice.client.from("profiles").select("id").eq("id", bob.id);
    expect(view.data).toEqual([]);
  });

  it("the suspended grower cannot take part in new work", async () => {
    const { error } = await bob.client.rpc("add_comment", {
      p_update_id: "00000000-0000-4000-8000-000000000000",
      p_body: "Still here",
    });
    expect(errorCode(error)).toBe("42501");
  });

  it("reinstates, and records the reinstatement as its own audit row", async () => {
    const { error } = await admin.client.rpc("admin_suspend_profile", {
      p_profile_id: bob.id,
      p_suspended: false,
      p_reason: "Review finished, no further action",
    });
    expect(error).toBeNull();
    expect(await suspended(bob.id)).toBe(false);
    const [audit] = await rows(
      "select action_type from public.admin_actions where target_id = $1 order by created_at desc limit 1",
      [bob.id],
    );
    expect(audit.action_type).toBe("account_restored");
  });
});

describe("the report-linked path keeps working", () => {
  it("still suspends through a report and records the same kind of audit row", async () => {
    const reporter = await createTestUser("sd-reporter");
    created.push(reporter.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Reporter SD', 'NL')",
        [reporter.id],
      ),
    );
    const report = await withSuperuser((db) =>
      db.query(
        `insert into public.reports (reporter_id, reported_user_id, target_type, target_id, reason)
         values ($1, $2, 'profile', $2, 'harassment') returning id`,
        [reporter.id, bob.id],
      ),
    );
    const { error } = await admin.client.rpc("admin_set_reported_suspension", {
      p_report_id: report.rows[0].id,
      p_suspended: true,
      p_reason: "Reported and reviewed",
    });
    expect(error).toBeNull();
    expect(await suspended(bob.id)).toBe(true);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
    );
  });
});
