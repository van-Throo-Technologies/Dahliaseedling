import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  localSupabase,
  removeTestUsers,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * Avatar access tests. They go through Supabase Storage itself (the same path the application
 * route uses) and through direct object URLs, not through the UI.
 *
 * Expected: an active profile's avatar is readable by visitors and other users. Once the profile is
 * suspended, nobody but its owner can read it, and knowing the path does not change that.
 */

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let admin: TestUser;
let aliceAvatar: string;
let bobAvatar: string;

function png(size = PNG.byteLength): Blob {
  const bytes = new Uint8Array(size);
  bytes.set(PNG.subarray(0, Math.min(PNG.byteLength, size)));
  return new Blob([bytes], { type: "image/png" });
}

async function upload(user: TestUser, path: string) {
  return user.client.storage.from("avatars").upload(path, png(), { contentType: "image/png" });
}

async function setAvatarPath(user: TestUser, path: string) {
  const { error } = await user.client
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);
  expect(error).toBeNull();
}

async function suspend(profileId: string, suspended: boolean) {
  const { error } = await admin.client.rpc("admin_suspend_profile", {
    p_profile_id: profileId,
    p_suspended: suspended,
    p_reason: "Automated test suspension for the avatar visibility check",
  });
  expect(error).toBeNull();
}

/** Direct object URL, the way a stray link or a guessed path would be requested. */
async function directObjectStatus(
  path: string,
  prefix: "object" | "object/public",
  token?: string,
) {
  const { apiUrl, publishableKey } = localSupabase();
  const response = await fetch(`${apiUrl}/storage/v1/${prefix}/avatars/${path}`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token ?? publishableKey}` },
  });
  return response.status;
}

beforeAll(async () => {
  alice = await createTestUser("avatar-alice");
  bob = await createTestUser("avatar-bob");
  admin = await createTestUser("avatar-admin");
  created.push(alice.id, bob.id, admin.id);

  await withSuperuser((db) =>
    db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]),
  );

  for (const user of [alice, bob, admin]) {
    const { error } = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: "Avatar Test", country_code: "NL" });
    expect(error).toBeNull();
  }

  aliceAvatar = `${alice.id}/first.png`;
  bobAvatar = `${bob.id}/first.png`;
  expect((await upload(alice, aliceAvatar)).error).toBeNull();
  expect((await upload(bob, bobAvatar)).error).toBeNull();
  await setAvatarPath(alice, aliceAvatar);
  await setAvatarPath(bob, bobAvatar);
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("avatar visibility follows profile visibility", () => {
  it("bucket is private: a public object URL is refused even for an active avatar", async () => {
    const status = await directObjectStatus(aliceAvatar, "object/public");
    expect(status).not.toBe(200);
  });

  it("an active profile's avatar can be downloaded by a visitor", async () => {
    const { data, error } = await visitor.storage.from("avatars").download(aliceAvatar);
    expect(error).toBeNull();
    expect(data?.type).toBe("image/png");
  });

  it("an active profile's avatar can be downloaded by another signed-in user", async () => {
    const { data, error } = await bob.client.storage.from("avatars").download(aliceAvatar);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("suspension hides the avatar from a visitor, even though the path is known", async () => {
    await suspend(bob.id, true);
    const { error } = await visitor.storage.from("avatars").download(bobAvatar);
    expect(error).not.toBeNull();
  });

  it("suspension hides the avatar from another ordinary user", async () => {
    const { error } = await alice.client.storage.from("avatars").download(bobAvatar);
    expect(error).not.toBeNull();
  });

  it("a direct object URL for a suspended avatar is refused, anonymously and with another user's token", async () => {
    expect(await directObjectStatus(bobAvatar, "object")).toBeGreaterThanOrEqual(400);
    const aliceToken = (await alice.client.auth.getSession()).data.session?.access_token;
    expect(aliceToken).toBeTruthy();
    expect(await directObjectStatus(bobAvatar, "object", aliceToken)).toBeGreaterThanOrEqual(400);
  });

  it("the suspended owner can still download their own avatar", async () => {
    const { data, error } = await bob.client.storage.from("avatars").download(bobAvatar);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("reinstating the profile restores visitor access", async () => {
    await suspend(bob.id, false);
    const { error } = await visitor.storage.from("avatars").download(bobAvatar);
    expect(error).toBeNull();
  });
});

describe("avatar replacement", () => {
  it("a replaced file stops being readable as soon as the profile points at the new one", async () => {
    const replacement = `${alice.id}/second.png`;
    expect((await upload(alice, replacement)).error).toBeNull();
    await setAvatarPath(alice, replacement);

    // The old file has not been deleted yet, but no profile points at it any more.
    const oldFile = await visitor.storage.from("avatars").download(aliceAvatar);
    expect(oldFile.error).not.toBeNull();

    const newFile = await visitor.storage.from("avatars").download(replacement);
    expect(newFile.error).toBeNull();
  });

  it("the owner can delete the previous file, and another user cannot", async () => {
    const intruder = await bob.client.storage.from("avatars").remove([`${alice.id}/second.png`]);
    expect(intruder.data ?? []).toEqual([]);

    const owner = await alice.client.storage.from("avatars").remove([aliceAvatar]);
    expect(owner.error).toBeNull();
    expect(owner.data).toHaveLength(1);

    const gone = await alice.client.storage.from("avatars").download(aliceAvatar);
    expect(gone.error).not.toBeNull();
  });
});

describe("avatar upload rules are unchanged", () => {
  it("lets an owner upload into their own folder", async () => {
    expect((await upload(alice, `${alice.id}/third.png`)).error).toBeNull();
  });

  it("refuses an upload into another user's folder", async () => {
    expect((await upload(bob, `${alice.id}/intruder.png`)).error).not.toBeNull();
  });

  it("refuses an anonymous upload", async () => {
    const { error } = await visitor.storage
      .from("avatars")
      .upload(`${alice.id}/anon.png`, png(), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("refuses an invalid MIME type", async () => {
    const { error } = await alice.client.storage
      .from("avatars")
      .upload(`${alice.id}/notes.txt`, new Blob(["text"], { type: "text/plain" }), {
        contentType: "text/plain",
      });
    expect(error).not.toBeNull();
  });

  it("refuses a file over the 2 MB limit", async () => {
    const { error } = await alice.client.storage
      .from("avatars")
      .upload(`${alice.id}/too-big.png`, png(2 * 1024 * 1024 + 1), { contentType: "image/png" });
    expect(error).not.toBeNull();
  });
});
