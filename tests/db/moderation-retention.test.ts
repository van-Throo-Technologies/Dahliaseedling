import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Phase 10B moderation retention. With no period set, nothing is disposed of. A period needs an administrator, and a recorded basis. Disposal
 * clears only personal text inside a decided report or a suspension reason. The report and the administrator action remain, and every run is
 * recorded.
 */

const tag = "mr" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let admin: TestUser;
let reporter: TestUser;
let reported: TestUser;
let decidedReport = "";
let openReport = "";
let oldSuspension = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

beforeAll(async () => {
  admin = await createTestUser("mr-admin");
  reporter = await createTestUser("mr-reporter");
  reported = await createTestUser("mr-reported");
  created.push(admin.id, reporter.id, reported.id);
  await withSuperuser(async (db) => {
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [admin.id, `Admin ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [reporter.id, `Reporter ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [reported.id, `Reported ${tag}`],
    );
    await db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]);
    const decided = await db.query(
      `insert into public.reports (reporter_id, reported_user_id, target_type, target_id, reason, details, status, content_snapshot, resolved_at, reviewed_by)
       values ($1, $2, 'profile', $2, 'harassment', 'The reporter wrote this', 'actioned', 'Snapshot of removed text', now() - interval '400 days', $3)
       returning id`,
      [reporter.id, reported.id, admin.id],
    );
    decidedReport = decided.rows[0].id as string;
    const open = await db.query(
      `insert into public.reports (reporter_id, reported_user_id, target_type, target_id, reason, details, content_snapshot)
       values ($1, $2, 'profile', $2, 'spam', 'Still under review', 'Open snapshot')
       returning id`,
      [reporter.id, reported.id],
    );
    openReport = open.rows[0].id as string;
    const suspension = await db.query(
      `insert into public.admin_actions (admin_id, action_type, target_type, target_id, reason, created_at)
       values ($1, 'account_suspended', 'profile', $2, 'Old suspension reason text', now() - interval '400 days')
       returning id`,
      [admin.id, reported.id],
    );
    oldSuspension = suspension.rows[0].id as string;
  });
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("no period means no disposal", () => {
  it("applying a category with no period changes nothing", async () => {
    const { data, error } = await admin.client.rpc("apply_retention_period", {
      p_category: "moderation_snapshot",
    });
    expect(error).toBeNull();
    expect(data).toBe(0);
    const [r] = await rows("select content_snapshot, details from public.reports where id = $1", [
      decidedReport,
    ]);
    expect(r).toEqual({
      content_snapshot: "Snapshot of removed text",
      details: "The reporter wrote this",
    });
  });
});

describe("setting a period is administrator-only, and needs a recorded basis", () => {
  it("refuses a grower", async () => {
    const { error } = await reporter.client.rpc("set_retention_period", {
      p_category: "moderation_snapshot",
      p_days: 30,
      p_basis: "Legal review ref 0001",
    });
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses a period without a recorded basis, and a zero period", async () => {
    expect(
      errorCode(
        (
          await admin.client.rpc("set_retention_period", {
            p_category: "moderation_snapshot",
            p_days: 30,
            p_basis: "short",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await admin.client.rpc("set_retention_period", {
            p_category: "moderation_snapshot",
            p_days: 0,
            p_basis: "Legal review ref 0001",
          })
        ).error,
      ),
    ).toBe("23514");
  });

  it("an administrator sets a period with its basis", async () => {
    const { error } = await admin.client.rpc("set_retention_period", {
      p_category: "moderation_snapshot",
      p_days: 30,
      p_basis: "Legal review ref 0001",
    });
    expect(error).toBeNull();
    const [policy] = await rows(
      "select retain_days, basis from public.retention_policies where category = 'moderation_snapshot'",
    );
    expect(policy).toEqual({ retain_days: 30, basis: "Legal review ref 0001" });
  });
});

describe("disposal clears personal text and keeps the record", () => {
  it("clears a decided report's snapshot and details after the period, and keeps the report row", async () => {
    const { data, error } = await admin.client.rpc("apply_retention_period", {
      p_category: "moderation_snapshot",
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThanOrEqual(1);
    const [r] = await rows(
      "select status, reason, content_snapshot, details from public.reports where id = $1",
      [decidedReport],
    );
    expect(r).toEqual({
      status: "actioned",
      reason: "harassment",
      content_snapshot: null,
      details: null,
    });
  });

  it("never touches an open report", async () => {
    const [r] = await rows(
      "select content_snapshot, details, status from public.reports where id = $1",
      [openReport],
    );
    expect(r).toEqual({
      content_snapshot: "Open snapshot",
      details: "Still under review",
      status: "open",
    });
  });

  it("clears a suspension reason after its period, keeps the action, and touches no other action type", async () => {
    await admin.client.rpc("set_retention_period", {
      p_category: "suspension_reason",
      p_days: 30,
      p_basis: "Legal review ref 0002",
    });
    const { error } = await admin.client.rpc("apply_retention_period", {
      p_category: "suspension_reason",
    });
    expect(error).toBeNull();
    const [row] = await rows("select action_type, reason from public.admin_actions where id = $1", [
      oldSuspension,
    ]);
    expect(row).toEqual({ action_type: "account_suspended", reason: null });
  });

  it("records every run", async () => {
    const runs = await rows(
      "select category, rows_cleared from public.retention_runs where admin_id = $1 order by applied_at",
      [admin.id],
    );
    expect(runs.map((r) => r.category)).toEqual(
      expect.arrayContaining(["moderation_snapshot", "suspension_reason"]),
    );
  });

  it("refuses a grower applying disposal", async () => {
    expect(
      errorCode(
        (await reporter.client.rpc("apply_retention_period", { p_category: "moderation_snapshot" }))
          .error,
      ),
    ).toBe("42501");
  });
});
