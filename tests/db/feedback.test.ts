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
 * Phase 10C feedback. A grower submits as themselves. Only an administrator reads feedback or changes its status. A retry does not count
 * twice, a refused input does not count at all, and the page context never keeps a query string. The former-grower name is reserved.
 */

const tag = "fb" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let admin: TestUser;

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function hits(user: string): Promise<number> {
  const [row] = await rows(
    "select coalesce(sum(hits),0)::int as n from public.rate_counters where user_id = $1 and action = 'feedback'",
    [user],
  );
  return row.n as number;
}

async function submit(user: TestUser, overrides: Record<string, unknown> = {}) {
  return user.client.rpc("submit_feedback", {
    p_client_key: crypto.randomUUID(),
    p_category: "idea",
    p_message: "Please add a bloom calendar",
    p_page_context: "/seedlings/3f2c1a7e-1111-4222-8333-444455556666",
    p_app_version: "abc1234",
    ...overrides,
  });
}

beforeAll(async () => {
  alice = await createTestUser("fb-alice");
  bob = await createTestUser("fb-bob");
  admin = await createTestUser("fb-admin");
  created.push(alice.id, bob.id, admin.id);
  await withSuperuser(async (db) => {
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [alice.id, `Alice ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'BE')",
      [bob.id, `Bob ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [admin.id, `Admin ${tag}`],
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

describe("a grower submits as themselves, once per key", () => {
  it("submits, and stores the author from the session", async () => {
    const result = await submit(alice);
    expect(result.error).toBeNull();
    const [row] = await rows(
      "select author_id::text, category, message, status from public.feedback where id = $1",
      [result.data as string],
    );
    expect(row).toEqual({
      author_id: alice.id,
      category: "idea",
      message: "Please add a bloom calendar",
      status: "new",
    });
  });

  it("a retry with the same key returns the first submission and counts nothing more", async () => {
    const key = crypto.randomUUID();
    const first = await submit(alice, { p_client_key: key });
    const before = await hits(alice.id);
    const again = await submit(alice, { p_client_key: key, p_message: "Changed on retry" });
    expect(again.data).toBe(first.data);
    expect(await hits(alice.id)).toBe(before);
    const [row] = await rows(
      "select count(*)::int as n, max(message) as m from public.feedback where client_key = $1",
      [key],
    );
    expect(row.n).toBe(1);
    expect(row.m).toBe("Please add a bloom calendar");
  });

  it("gives no client a way to name another author, or to write the table directly", async () => {
    const forged = await alice.client.rpc("submit_feedback", {
      p_client_key: crypto.randomUUID(),
      p_category: "idea",
      p_message: "Forged",
      p_page_context: null,
      p_app_version: null,
      p_author_id: bob.id,
    } as never);
    expect(forged.error?.code).toBe("PGRST202");
    const direct = await alice.client.from("feedback").insert({
      author_id: alice.id,
      client_key: crypto.randomUUID(),
      category: "idea",
      message: "Direct",
    } as never);
    expect(errorCode(direct.error)).toBe("42501");
  });
});

describe("refused input does not count", () => {
  it.each([
    ["an unknown category", { p_category: "praise" }],
    ["an empty message", { p_message: "   " }],
    ["a message over 2000 characters", { p_message: "x".repeat(2001) }],
  ])("refuses %s with a plain code, and stores nothing", async (_label, override) => {
    const before = await hits(bob.id);
    const result = await submit(bob, override);
    expect(errorCode(result.error)).toBe("23514");
    expect(await hits(bob.id)).toBe(before);
  });

  it("refuses a request without a form key", async () => {
    expect(errorCode((await submit(bob, { p_client_key: null })).error)).toBe("23514");
  });
});

describe("the daily quota is actor-scoped and atomic", () => {
  it("admits ten a day for one grower, refuses the eleventh, and leaves another grower unaffected", async () => {
    const quota = await createTestUser("fb-quota");
    created.push(quota.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Quota', 'NL')",
        [quota.id],
      ),
    );
    for (let i = 0; i < 10; i++) {
      expect((await submit(quota)).error, `submission ${i + 1}`).toBeNull();
    }
    expect(errorCode((await submit(quota)).error)).toBe("53400");
    expect(await hits(quota.id)).toBe(10);
    expect((await submit(alice)).error).toBeNull();
  });
});

describe("the page context keeps only a path", () => {
  it("drops the query string and fragment, and replaces identifiers", async () => {
    const result = await submit(alice, {
      p_page_context: "/seedlings/3f2c1a7e-1111-4222-8333-444455556666?token=secret&x=1#frag",
    });
    const [row] = await rows("select page_context from public.feedback where id = $1", [
      result.data as string,
    ]);
    expect(row.page_context).toBe("/seedlings/:id");
  });

  it("keeps nothing that is not a plain path", async () => {
    const result = await submit(alice, { p_page_context: "https://evil.example/x" });
    const [row] = await rows("select page_context from public.feedback where id = $1", [
      result.data as string,
    ]);
    expect(row.page_context).toBeNull();
  });
});

describe("only administrators read, or change status", () => {
  let feedbackId = "";

  beforeAll(async () => {
    feedbackId = (await submit(alice)).data as string;
  });

  it("a grower cannot read feedback, not even their own", async () => {
    const read = await alice.client.from("feedback").select("id");
    expect(read.data ?? []).toEqual([]);
  });

  it("a visitor cannot read feedback", async () => {
    const read = await visitor.from("feedback").select("id");
    expect(read.data ?? []).toEqual([]);
  });

  it("a grower cannot change status, by function or directly", async () => {
    expect(
      errorCode(
        (
          await alice.client.rpc("admin_set_feedback_status", {
            p_feedback_id: feedbackId,
            p_status: "resolved",
          })
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client
            .from("feedback")
            .update({ status: "resolved" } as never)
            .eq("id", feedbackId)
        ).error,
      ),
    ).toBe("42501");
    const [row] = await rows("select status from public.feedback where id = $1", [feedbackId]);
    expect(row.status).toBe("new");
  });

  it("an administrator reads feedback and moves it through new, reviewing and resolved", async () => {
    const read = await admin.client.from("feedback").select("id, status").eq("id", feedbackId);
    expect(read.data).toEqual([{ id: feedbackId, status: "new" }]);
    for (const status of ["reviewing", "resolved"]) {
      expect(
        (
          await admin.client.rpc("admin_set_feedback_status", {
            p_feedback_id: feedbackId,
            p_status: status,
          })
        ).error,
      ).toBeNull();
    }
    const [row] = await rows("select status from public.feedback where id = $1", [feedbackId]);
    expect(row.status).toBe("resolved");
    expect(
      errorCode(
        (
          await admin.client.rpc("admin_set_feedback_status", {
            p_feedback_id: feedbackId,
            p_status: "closed",
          })
        ).error,
      ),
    ).toBe("23514");
  });
});

describe("accounts that cannot act cannot submit", () => {
  it("refuses an anonymous visitor", async () => {
    expect(
      errorCode(
        (
          await visitor.rpc("submit_feedback", {
            p_client_key: crypto.randomUUID(),
            p_category: "idea",
            p_message: "x",
            p_page_context: null,
            p_app_version: null,
          })
        ).error,
      ),
    ).toBe("42501");
  });

  it("refuses a deactivated account", async () => {
    const leaving = await createTestUser("fb-leaving");
    created.push(leaving.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Leaving', 'NL')",
        [leaving.id],
      ),
    );
    expect((await leaving.client.rpc("deactivate_my_account")).error).toBeNull();
    expect(errorCode((await submit(leaving)).error)).toBe("42501");
  });
});

describe("the former-grower name is reserved for accounts that are not active", () => {
  it("an active grower cannot take the reserved name, in any capitalisation or spacing", async () => {
    for (const name of ["Former grower", "former grower", "  FORMER GROWER "]) {
      const result = await alice.client
        .from("profiles")
        .update({ display_name: name })
        .eq("id", alice.id);
      expect(result.error, name).not.toBeNull();
    }
    const [row] = await rows("select display_name from public.profiles where id = $1", [alice.id]);
    expect(row.display_name).toBe(`Alice ${tag}`);
  });

  it("an active grower may use any other name", async () => {
    const result = await alice.client
      .from("profiles")
      .update({ display_name: `Alice ${tag}` })
      .eq("id", alice.id);
    expect(result.error).toBeNull();
  });
});
