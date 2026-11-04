import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Moderation: reports on Updates, comments, profiles and private messages; the trusted report boundary; administrator review
 * that starts from a report; removal as a soft delete; and suspension through the Phase 1 authority. Every write goes through
 * the function a browser calls, and the report contents are checked from the reporter's and the reported grower's sides.
 */

const visitor = anonClient();
const tag = "mod" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser; // author of a public Update and holder of the Seedling
let bob: TestUser; // commenter, reporter of Alice's content, later suspended and restored
let carol: TestUser; // an unrelated grower, later suspended for the report test
let dan: TestUser; // administrator for this suite only
let seedling = "";
let updateId = "";
let commentId = "";
let conv = "";
let privateMessage = "";
let reportUpdate = "";
let reportComment = "";
let reportProfile = "";
let reportMessage = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

beforeAll(async () => {
  alice = await createTestUser("mod-alice");
  bob = await createTestUser("mod-bob");
  carol = await createTestUser("mod-carol");
  dan = await createTestUser("mod-dan");
  created.push(alice.id, bob.id, carol.id, dan.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });
  await carol.client
    .from("profiles")
    .insert({ id: carol.id, display_name: `Carol ${tag}`, country_code: "DE" });
  await dan.client
    .from("profiles")
    .insert({ id: dan.id, display_name: `Dan ${tag}`, country_code: "FR" });

  const { data, error } = await alice.client.rpc("create_seedling", {
    p_working_name: `Moderated ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  seedling = data!.id as string;

  const photo = await capturePhoto(alice, seedling);
  updateId = (await publishPublicImage(alice, photo)).updateId;

  const comment = await carol.client.rpc("add_comment", {
    p_update_id: updateId,
    p_body: `A comment ${tag}`,
  });
  if (comment.error) throw new Error(comment.error.message);
  commentId = comment.data as string;

  // A private conversation between Alice and Bob; Carol is the unrelated grower.
  const started = await alice.client.rpc("start_direct_conversation", { p_other: bob.id });
  if (started.error) throw new Error(started.error.message);
  conv = started.data as string;
  const sent = await alice.client.rpc("send_message", {
    p_conversation_id: conv,
    p_client_key: crypto.randomUUID(),
    p_body: `A private note ${tag}`,
  });
  if (sent.error) throw new Error(sent.error.message);
  privateMessage = sent.data as string;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("reporting: eligibility and the trusted boundary", () => {
  it("a visitor cannot submit a report", async () => {
    const result = await visitor.rpc("create_report", {
      p_target_type: "update",
      p_target_id: updateId,
      p_reason: "spam",
    });
    expect(errorCode(result.error)).toBe("42501");
  });

  it("an eligible grower reports a public Update; the report keeps the reported grower and the caption", async () => {
    const result = await bob.client.rpc("create_report", {
      p_target_type: "update",
      p_target_id: updateId,
      p_reason: "spam",
      p_details: "Looks like an advert",
    });
    expect(result.error).toBeNull();
    reportUpdate = result.data as string;
    const stored = await rows(
      "select reported_user_id, content_snapshot, target_update_id from public.reports where id = $1",
      [reportUpdate],
    );
    expect(stored[0].reported_user_id).toBe(alice.id);
    expect(stored[0].target_update_id).toBeNull();
    expect(stored[0].content_snapshot).toBe("Fixture update");
  });

  it("repeating an open report of the same target returns the same report", async () => {
    const again = await bob.client.rpc("create_report", {
      p_target_type: "update",
      p_target_id: updateId,
      p_reason: "harassment",
    });
    expect(again.data).toBe(reportUpdate);
    const open = await rows(
      "select count(*)::int as n from public.reports where reporter_id = $1 and target_id = $2 and status = 'open'",
      [bob.id, updateId],
    );
    expect(open[0].n).toBe(1);
  });

  it("an eligible grower reports a comment; the comment is kept, not removed, and the report names its Update", async () => {
    const result = await bob.client.rpc("create_report", {
      p_target_type: "comment",
      p_target_id: commentId,
      p_reason: "inappropriate",
    });
    expect(result.error).toBeNull();
    reportComment = result.data as string;
    const comment = await rows("select deleted_at from public.comments where id = $1", [commentId]);
    expect(comment[0].deleted_at).toBeNull();
    const stored = await rows(
      "select reported_user_id, target_update_id, content_snapshot from public.reports where id = $1",
      [reportComment],
    );
    expect(stored[0]).toEqual({
      reported_user_id: carol.id,
      target_update_id: updateId,
      content_snapshot: `A comment ${tag}`,
    });
  });

  it("an eligible grower reports another grower's profile; reporting does not verify or change the profile", async () => {
    const result = await bob.client.rpc("create_report", {
      p_target_type: "profile",
      p_target_id: alice.id,
      p_reason: "spam",
    });
    expect(result.error).toBeNull();
    reportProfile = result.data as string;
    const profile = await rows("select is_suspended from public.profiles where id = $1", [
      alice.id,
    ]);
    expect(profile[0].is_suspended).toBe(false);
  });

  it("a participant reports a private message they may read; the report keeps the text it had", async () => {
    const result = await bob.client.rpc("create_report", {
      p_target_type: "message",
      p_target_id: privateMessage,
      p_reason: "harassment",
    });
    expect(result.error).toBeNull();
    reportMessage = result.data as string;
    const stored = await rows(
      "select reported_user_id, content_snapshot, conversation_id from public.reports where id = $1",
      [reportMessage],
    );
    expect(stored[0]).toEqual({
      reported_user_id: alice.id,
      content_snapshot: `A private note ${tag}`,
      conversation_id: conv,
    });
  });

  it("an unrelated grower who knows a message id cannot report it, and cannot read the conversation", async () => {
    const result = await carol.client.rpc("create_report", {
      p_target_type: "message",
      p_target_id: privateMessage,
      p_reason: "spam",
    });
    expect(errorCode(result.error)).toBe("P0002");
    const read = await carol.client.from("conversations").select("id").eq("id", conv);
    expect(read.data ?? []).toEqual([]);
  });

  it("refuses self-reporting for every target, and refuses unknown or invalid targets", async () => {
    expect(
      errorCode(
        (
          await alice.client.rpc("create_report", {
            p_target_type: "update",
            p_target_id: updateId,
            p_reason: "spam",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await carol.client.rpc("create_report", {
            p_target_type: "comment",
            p_target_id: commentId,
            p_reason: "spam",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await alice.client.rpc("create_report", {
            p_target_type: "profile",
            p_target_id: alice.id,
            p_reason: "spam",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await alice.client.rpc("create_report", {
            p_target_type: "message",
            p_target_id: privateMessage,
            p_reason: "spam",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await bob.client.rpc("create_report", {
            p_target_type: "media",
            p_target_id: updateId,
            p_reason: "spam",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await bob.client.rpc("create_report", {
            p_target_type: "update",
            p_target_id: crypto.randomUUID(),
            p_reason: "spam",
          })
        ).error,
      ),
    ).toBe("P0002");
    expect(
      errorCode(
        (
          await bob.client.rpc("create_report", {
            p_target_type: "update",
            p_target_id: updateId,
            p_reason: "rude",
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await bob.client.rpc("create_report", {
            p_target_type: "update",
            p_target_id: updateId,
            p_reason: "spam",
            p_details: "x".repeat(1001),
          })
        ).error,
      ),
    ).toBe("23514");
  });

  it("a suspended grower cannot submit a report", async () => {
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [carol.id]),
    );
    try {
      const result = await carol.client.rpc("create_report", {
        p_target_type: "profile",
        p_target_id: bob.id,
        p_reason: "spam",
      });
      expect(errorCode(result.error)).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [carol.id]),
      );
    }
  });

  it("the report table cannot be written directly, and the reported grower's identity is not granted to clients", async () => {
    const insert = await bob.client.from("reports").insert({
      reporter_id: bob.id,
      reported_user_id: alice.id,
      target_type: "profile",
      target_id: alice.id,
      reason: "spam",
    });
    expect(insert.error).not.toBeNull();
    const column = await bob.client
      .from("reports")
      .select("reported_user_id")
      .eq("id", reportUpdate);
    expect(column.error).not.toBeNull();
  });
});

describe("report privacy", () => {
  it("the reporter sees their own report, and the reported grower does not", async () => {
    const reporter = await bob.client
      .from("reports")
      .select("id, target_type")
      .eq("id", reportUpdate);
    expect(reporter.data).toEqual([{ id: reportUpdate, target_type: "update" }]);
    const reported = await alice.client.from("reports").select("id").eq("id", reportUpdate);
    expect(reported.data ?? []).toEqual([]);
  });

  it("an unrelated grower and a visitor cannot read reports", async () => {
    const unrelated = await carol.client.from("reports").select("id");
    expect(unrelated.data ?? []).toEqual([]);
    const anon = await visitor.from("reports").select("id");
    expect(anon.data ?? []).toEqual([]);
  });

  it("the reported grower cannot resolve their own report", async () => {
    const result = await alice.client.rpc("resolve_report", {
      p_report_id: reportUpdate,
      p_status: "dismissed",
    });
    expect(errorCode(result.error)).toBe("42501");
  });
});

describe("administrator review", () => {
  beforeAll(async () => {
    await withSuperuser((db) =>
      db.query("insert into public.admin_users (user_id) values ($1)", [dan.id]),
    );
  });
  afterAll(async () => {
    await withSuperuser((db) =>
      db.query("delete from public.admin_users where user_id = $1", [dan.id]),
    );
  });

  it("a grower and a visitor cannot use any administrator function", async () => {
    expect(
      errorCode((await bob.client.rpc("admin_list_reports", { p_show_all: true })).error),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await bob.client.rpc("resolve_report", {
            p_report_id: reportUpdate,
            p_status: "dismissed",
          })
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (await bob.client.rpc("admin_remove_content", { p_report_id: reportUpdate })).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await bob.client.rpc("admin_set_reported_suspension", {
            p_report_id: reportUpdate,
            p_suspended: true,
          })
        ).error,
      ),
    ).toBe("42501");
    expect(errorCode((await visitor.rpc("admin_list_reports", { p_show_all: true })).error)).toBe(
      "42501",
    );
    const isAdmin = await bob.client.rpc("is_admin");
    expect(isAdmin.data).toBe(false);
  });

  it("an administrator reviews reports, with the target context and the saved content, and no conversation", async () => {
    const { data, error } = await dan.client.rpc("admin_list_reports", { p_show_all: false });
    expect(error).toBeNull();
    const row = (
      data as {
        id: string;
        target_live: boolean;
        reporter_name: string;
        reported_name: string;
        content_snapshot: string;
        target_update_id: string | null;
        is_message: boolean;
      }[]
    ).find((r) => r.id === reportUpdate);
    expect(row).toMatchObject({
      target_live: true,
      reporter_name: `Bob ${tag}`,
      reported_name: `Alice ${tag}`,
    });

    const messageRow = (
      data as { id: string; is_message: boolean; content_snapshot: string; target_live: boolean }[]
    ).find((r) => r.id === reportMessage);
    expect(messageRow).toMatchObject({
      is_message: true,
      content_snapshot: `A private note ${tag}`,
      target_live: false,
    });
  });

  it("an administrator resolves a report once; a repeated resolution is refused and the record does not change", async () => {
    const first = await dan.client.rpc("resolve_report", {
      p_report_id: reportProfile,
      p_status: "dismissed",
      p_reason: "Reviewed the profile",
    });
    expect(first.error).toBeNull();
    const repeat = await dan.client.rpc("resolve_report", {
      p_report_id: reportProfile,
      p_status: "actioned",
    });
    expect(errorCode(repeat.error)).toBe("P0001");
    const stored = await rows("select status, reviewed_by from public.reports where id = $1", [
      reportProfile,
    ]);
    expect(stored[0]).toEqual({ status: "dismissed", reviewed_by: dan.id });
    const logged = await rows(
      "select count(*)::int as n from public.admin_actions where target_id = $1 and action_type = 'report_resolved'",
      [alice.id],
    );
    expect(logged[0].n).toBe(1);
  });

  it("removing a public comment is a soft delete, logged once, and the comment is hidden from the public", async () => {
    const commentReport = await dan.client.rpc("admin_remove_content", {
      p_report_id: reportComment,
      p_reason: "Abusive reply",
    });
    expect(commentReport.error).toBeNull();
    const again = await dan.client.rpc("admin_remove_content", { p_report_id: reportComment });
    expect(again.error).toBeNull();
    const stored = await rows("select deleted_at from public.comments where id = $1", [commentId]);
    expect(stored[0].deleted_at).not.toBeNull();
    const logged = await rows(
      "select count(*)::int as n from public.admin_actions where target_id = $1 and action_type = 'content_removed'",
      [commentId],
    );
    expect(logged[0].n).toBe(1);
    // The removed comment keeps its place in the thread, marked as removed; its text is not granted to visitors at all.
    const marked = await visitor.from("comments").select("id, deleted_at").eq("id", commentId);
    expect(marked.data?.[0]?.deleted_at).not.toBeNull();
    const text = await visitor.from("comments").select("body").eq("id", commentId);
    expect(text.error).not.toBeNull();
  });

  it("removing a public Update keeps the Seedling identity and provenance, and the Update leaves public view", async () => {
    const before = await rows(
      "select originator_id, current_holder_id from public.seedlings where id = $1",
      [seedling],
    );
    const removal = await dan.client.rpc("admin_remove_content", {
      p_report_id: reportUpdate,
      p_reason: "Advert",
    });
    expect(removal.error).toBeNull();
    const stored = await rows("select deleted_at from public.updates where id = $1", [updateId]);
    expect(stored[0].deleted_at).not.toBeNull();
    const after = await rows(
      "select originator_id, current_holder_id from public.seedlings where id = $1",
      [seedling],
    );
    expect(after[0]).toEqual(before[0]);
    const visible = await visitor.from("updates").select("id").eq("id", updateId);
    expect(visible.data ?? []).toEqual([]);
  });

  it("a private message cannot be removed by this path; its report stays evidence", async () => {
    const result = await dan.client.rpc("admin_remove_content", { p_report_id: reportMessage });
    expect(errorCode(result.error)).toBe("23514");
    const stored = await rows("select body from public.messages where id = $1", [privateMessage]);
    expect(stored[0].body).toBe(`A private note ${tag}`);
  });

  it("an administrator suspends a reported grower through the existing authority; they cannot take part, and the account is restored", async () => {
    const report = await carol.client.rpc("create_report", {
      p_target_type: "profile",
      p_target_id: bob.id,
      p_reason: "harassment",
    });
    expect(report.error).toBeNull();
    const suspend = await dan.client.rpc("admin_set_reported_suspension", {
      p_report_id: report.data as string,
      p_suspended: true,
      p_reason: "Repeated harassment",
    });
    expect(suspend.error).toBeNull();
    const flag = await rows("select is_suspended from public.profiles where id = $1", [bob.id]);
    expect(flag[0].is_suspended).toBe(true);
    const blocked = await bob.client.rpc("start_direct_conversation", { p_other: alice.id });
    expect(errorCode(blocked.error)).toBe("42501");
    const publicProfile = await visitor.from("profiles").select("id").eq("id", bob.id);
    expect(publicProfile.data ?? []).toEqual([]);

    const restore = await dan.client.rpc("admin_set_reported_suspension", {
      p_report_id: report.data as string,
      p_suspended: false,
    });
    expect(restore.error).toBeNull();
    const audit = await rows(
      "select action_type from public.admin_actions where target_id = $1 order by created_at",
      [bob.id],
    );
    expect(audit.map((r) => r.action_type)).toEqual(["account_suspended", "account_restored"]);
  });

  it("an administrator cannot suspend their own account from a report that names them", async () => {
    const report = await bob.client.rpc("create_report", {
      p_target_type: "profile",
      p_target_id: dan.id,
      p_reason: "spam",
    });
    expect(report.error).toBeNull();
    const result = await dan.client.rpc("admin_set_reported_suspension", {
      p_report_id: report.data as string,
      p_suspended: true,
    });
    expect(errorCode(result.error)).toBe("23514");
    const flag = await rows("select is_suspended from public.profiles where id = $1", [dan.id]);
    expect(flag[0].is_suspended).toBe(false);
  });
});
