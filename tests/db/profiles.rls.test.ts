import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * Behavioural authorization tests for profiles, admin status and avatar storage.
 *
 * Each test sends a real request as a visitor, a signed-in user or an admin, and checks what the
 * database allows. Denied requests are the important cases: a request that is refused is the
 * security boundary, whatever the UI shows.
 *
 * PostgREST error codes: 42501 = insufficient privilege (grant or RLS), 23514 = check violation.
 */

const created: string[] = [];

const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let dave: TestUser; // authenticated, has no profile yet
let admin: TestUser;

async function profileRow(id: string) {
  return withSuperuser(async (db) => {
    const result = await db.query(
      "select display_name, bio, is_suspended, account_type_label, country_code from public.profiles where id = $1",
      [id],
    );
    return result.rows[0] as
      | {
          display_name: string;
          bio: string | null;
          is_suspended: boolean;
          account_type_label: string | null;
          country_code: string;
        }
      | undefined;
  });
}

beforeAll(async () => {
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
  dave = await createTestUser("dave");
  admin = await createTestUser("admin");
  created.push(alice.id, bob.id, dave.id, admin.id);

  await withSuperuser((db) =>
    db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]),
  );

  const aliceInsert = await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: "Alice Grower", country_code: "NL" });
  expect(aliceInsert.error).toBeNull();

  const bobInsert = await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: "Bob Grower", country_code: "DE" });
  expect(bobInsert.error).toBeNull();

  const adminInsert = await admin.client
    .from("profiles")
    .insert({ id: admin.id, display_name: "Admin Account", country_code: "BE" });
  expect(adminInsert.error).toBeNull();
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("reading profiles", () => {
  it("lets a visitor read an eligible public profile", async () => {
    const { data, error } = await visitor
      .from("profiles")
      .select("id, display_name")
      .eq("id", alice.id);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: alice.id, display_name: "Alice Grower" }]);
  });

  it("lets a signed-in user read another user's public profile", async () => {
    const { data, error } = await bob.client
      .from("profiles")
      .select("id, display_name")
      .eq("id", alice.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});

describe("writing profiles", () => {
  it("lets a user update their own permitted fields", async () => {
    const { data, error } = await alice.client
      .from("profiles")
      .update({ bio: "Growing from seed since 2024." })
      .eq("id", alice.id)
      .select("bio");
    expect(error).toBeNull();
    expect(data).toEqual([{ bio: "Growing from seed since 2024." }]);
    expect((await profileRow(alice.id))?.bio).toBe("Growing from seed since 2024.");
  });

  it("silently changes nothing when a user targets another user's profile", async () => {
    const { data, error } = await bob.client
      .from("profiles")
      .update({ display_name: "Hijacked" })
      .eq("id", alice.id)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await profileRow(alice.id))?.display_name).toBe("Alice Grower");
  });

  it("refuses to create a profile for another user's id", async () => {
    const { error } = await alice.client
      .from("profiles")
      .insert({ id: dave.id, display_name: "Impostor", country_code: "FR" });
    expect(errorCode(error)).toBe("42501");
    expect(await profileRow(dave.id)).toBeUndefined();
  });

  it("refuses profile creation by a visitor", async () => {
    const { error } = await visitor
      .from("profiles")
      .insert({ id: dave.id, display_name: "Visitor", country_code: "FR" });
    expect(errorCode(error)).toBe("42501");
    expect(await profileRow(dave.id)).toBeUndefined();
  });

  it("refuses profile updates by a visitor", async () => {
    const { error } = await visitor
      .from("profiles")
      .update({ bio: "Edited by a visitor" })
      .eq("id", alice.id);
    expect(errorCode(error)).toBe("42501");
    expect((await profileRow(alice.id))?.bio).toBe("Growing from seed since 2024.");
  });

  it("refuses to set the suspension flag through a normal update", async () => {
    const { error } = await alice.client
      .from("profiles")
      .update({ is_suspended: true })
      .eq("id", alice.id);
    expect(errorCode(error)).toBe("42501");
    expect((await profileRow(alice.id))?.is_suspended).toBe(false);
  });

  it("refuses to change the profile id, so identity cannot be moved", async () => {
    const { error } = await alice.client.from("profiles").update({ id: bob.id }).eq("id", alice.id);
    expect(errorCode(error)).toBe("42501");
    expect((await profileRow(alice.id))?.display_name).toBe("Alice Grower");
  });

  it("refuses profile deletion by anyone", async () => {
    const { error } = await alice.client.from("profiles").delete().eq("id", alice.id);
    expect(errorCode(error)).toBe("42501");
    expect(await profileRow(alice.id)).toBeDefined();
  });

  it("accepts only the listed account presentation labels", async () => {
    const rejected = await alice.client
      .from("profiles")
      .update({ account_type_label: "admin" })
      .eq("id", alice.id);
    expect(errorCode(rejected.error)).toBe("23514");

    const accepted = await alice.client
      .from("profiles")
      .update({ account_type_label: "breeder" })
      .eq("id", alice.id);
    expect(accepted.error).toBeNull();
    expect((await profileRow(alice.id))?.account_type_label).toBe("breeder");
  });

  it("rejects a country code that is not an upper-case ISO code", async () => {
    const { error } = await dave.client
      .from("profiles")
      .insert({ id: dave.id, display_name: "Dave Grower", country_code: "nl" });
    expect(errorCode(error)).toBe("23514");
  });

  it("lets a user create their own profile", async () => {
    const { error } = await dave.client
      .from("profiles")
      .insert({ id: dave.id, display_name: "Dave Grower", country_code: "US" });
    expect(error).toBeNull();
  });
});

describe("admin and suspension", () => {
  it("refuses a normal user calling the suspension function on themselves", async () => {
    const { error } = await alice.client.rpc("admin_set_suspended", {
      target_profile_id: alice.id,
      suspended: true,
    });
    expect(errorCode(error)).toBe("42501");
    expect((await profileRow(alice.id))?.is_suspended).toBe(false);
  });

  it("refuses a normal user suspending another user", async () => {
    const { error } = await alice.client.rpc("admin_set_suspended", {
      target_profile_id: bob.id,
      suspended: true,
    });
    expect(errorCode(error)).toBe("42501");
    expect((await profileRow(bob.id))?.is_suspended).toBe(false);
  });

  it("refuses a visitor calling the suspension function", async () => {
    const { error } = await visitor.rpc("admin_set_suspended", {
      target_profile_id: bob.id,
      suspended: true,
    });
    expect(errorCode(error)).toBe("42501");
  });

  it("lets an admin suspend a profile, which hides it from visitors", async () => {
    const { data, error } = await admin.client.rpc("admin_set_suspended", {
      target_profile_id: bob.id,
      suspended: true,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ id: bob.id, is_suspended: true });

    const visitorView = await visitor.from("profiles").select("id").eq("id", bob.id);
    expect(visitorView.data).toEqual([]);

    const otherUserView = await alice.client.from("profiles").select("id").eq("id", bob.id);
    expect(otherUserView.data).toEqual([]);
  });

  it("still shows a suspended user their own profile, but blocks editing it", async () => {
    const own = await bob.client.from("profiles").select("id, is_suspended").eq("id", bob.id);
    expect(own.data).toEqual([{ id: bob.id, is_suspended: true }]);

    const edit = await bob.client
      .from("profiles")
      .update({ bio: "Still editing" })
      .eq("id", bob.id)
      .select("id");
    expect(edit.error).toBeNull();
    expect(edit.data).toEqual([]);
    expect((await profileRow(bob.id))?.bio).toBeNull();
  });

  it("lets an admin reinstate a profile, which restores public visibility", async () => {
    const { error } = await admin.client.rpc("admin_set_suspended", {
      target_profile_id: bob.id,
      suspended: false,
    });
    expect(error).toBeNull();
    const visitorView = await visitor.from("profiles").select("id").eq("id", bob.id);
    expect(visitorView.data).toEqual([{ id: bob.id }]);
  });

  it("lets only an admin read the admin list, and only their own row", async () => {
    const adminOwnRow = await admin.client.from("admin_users").select("user_id");
    expect(adminOwnRow.data).toEqual([{ user_id: admin.id }]);

    const userView = await alice.client.from("admin_users").select("user_id");
    expect(userView.data).toEqual([]);
  });

  it("refuses a user making themselves an admin", async () => {
    const { error } = await alice.client.from("admin_users").insert({ user_id: alice.id });
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses a visitor reading the admin list", async () => {
    const { error } = await visitor.from("admin_users").select("user_id");
    expect(errorCode(error)).toBe("42501");
  });

  it("gives no admin power through a profile field", async () => {
    const { error } = await alice.client
      .from("profiles")
      .update({ account_type_label: "farm", is_admin: true } as never)
      .eq("id", alice.id);
    expect(error).not.toBeNull();
  });
});

describe("avatar storage", () => {
  const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

  it("lets a user upload into their own folder", async () => {
    const { error } = await alice.client.storage
      .from("avatars")
      .upload(`${alice.id}/test.png`, png(), {
        contentType: "image/png",
      });
    expect(error).toBeNull();
  });

  it("refuses an upload into another user's folder", async () => {
    const { error } = await bob.client.storage
      .from("avatars")
      .upload(`${alice.id}/intruder.png`, png(), {
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
  });

  it("refuses an anonymous upload", async () => {
    const { error } = await visitor.storage.from("avatars").upload(`${alice.id}/anon.png`, png(), {
      contentType: "image/png",
    });
    expect(error).not.toBeNull();
  });

  it("refuses a file type the bucket does not allow", async () => {
    const { error } = await alice.client.storage
      .from("avatars")
      .upload(`${alice.id}/notes.txt`, new Blob(["text"], { type: "text/plain" }), {
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });
});
