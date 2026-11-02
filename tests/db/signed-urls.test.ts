import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * The signed-URL boundary for public derivatives. A visitor may receive a link to a derivative only while a
 * live public Update references it. Removing or suppressing that Update stops new links at once. A link that
 * was already issued keeps working until its own expiry: that residual window is accepted for the MVP.
 */

const created: string[] = [];
const visitor = anonClient();
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const ONE_HOUR_SECONDS = 3600;

let alice: TestUser;
let seedling: string;

async function scalar(
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown> | undefined> {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows[0]);
}

/** Publishes one image from a fresh observation and returns the Update and its public derivative path. */
async function publishOne(caption: string): Promise<{ update: string; derivative: string }> {
  const original = `${alice.id}/${crypto.randomUUID()}.jpg`;
  await alice.client.storage
    .from("private-media")
    .upload(original, new Blob([JPEG], { type: "image/jpeg" }), {
      contentType: "image/jpeg",
      upsert: false,
    });
  const captured = await alice.client.rpc("capture_observation", {
    p_seedling_id: seedling,
    p_new_seedling: false,
    p_paths: [original],
  });
  if (captured.error) throw new Error(captured.error.message);
  const media = (await scalar(
    "select media_id from public.observation_media where observation_id = $1",
    [captured.data!.id],
  )) as { media_id: string };

  const derivative = `${alice.id}/${crypto.randomUUID()}.webp`;
  await alice.client.storage
    .from("public-media")
    .upload(derivative, new Blob([WEBP], { type: "image/webp" }), {
      contentType: "image/webp",
      upsert: false,
    });
  const published = await alice.client.rpc("publish_update", {
    p_observation_id: captured.data!.id,
    p_client_key: crypto.randomUUID(),
    p_items: [
      {
        media_id: media.media_id,
        derivative_path: derivative,
        width: 800,
        height: 600,
        byte_size: 4096,
      },
    ],
    p_caption: caption,
  });
  if (published.error) throw new Error(published.error.message);
  return { update: (published.data as { id: string }).id, derivative };
}

/** The `iat` and `exp` claims inside a signed URL's token, read without trusting anything else in the URL. */
function tokenLifetime(signedUrl: string): number {
  const token = new URL(signedUrl).searchParams.get("token");
  if (!token) throw new Error("the signed URL has no token");
  const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as {
    iat: number;
    exp: number;
  };
  return payload.exp - payload.iat;
}

beforeAll(async () => {
  alice = await createTestUser("signed-alice");
  created.push(alice.id);
  const profile = await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: "Signed Links", country_code: "BE" });
  expect(profile.error).toBeNull();
  seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Link Ember",
      p_visibility: "public",
    })
  ).data!.id;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("issuing a signed URL for a public derivative", () => {
  it("issues a link while the Update is eligible, with a one-hour lifetime", async () => {
    const { derivative } = await publishOne("Eligible");
    const signed = await visitor.storage
      .from("public-media")
      .createSignedUrl(derivative, ONE_HOUR_SECONDS);
    expect(signed.error).toBeNull();
    expect(signed.data?.signedUrl).toBeTruthy();
    expect(tokenLifetime(signed.data!.signedUrl)).toBe(ONE_HOUR_SECONDS);
  });

  it("issues no link for a derivative that no Update references", async () => {
    const orphan = `${alice.id}/${crypto.randomUUID()}.webp`;
    await alice.client.storage
      .from("public-media")
      .upload(orphan, new Blob([WEBP], { type: "image/webp" }), {
        contentType: "image/webp",
        upsert: false,
      });
    const signed = await visitor.storage
      .from("public-media")
      .createSignedUrl(orphan, ONE_HOUR_SECONDS);
    expect(signed.error).not.toBeNull();
    expect(signed.data).toBeNull();
  });

  it("issues no new link after the Update is deleted, and the object is retained", async () => {
    const { update, derivative } = await publishOne("To be removed");
    const before = await visitor.storage
      .from("public-media")
      .createSignedUrl(derivative, ONE_HOUR_SECONDS);
    expect(before.error).toBeNull();

    expect((await alice.client.rpc("delete_update", { p_update_id: update })).error).toBeNull();

    const after = await visitor.storage
      .from("public-media")
      .createSignedUrl(derivative, ONE_HOUR_SECONDS);
    expect(after.error).not.toBeNull();
    expect(after.data).toBeNull();
    const object = await scalar("select count(*)::int as n from storage.objects where name = $1", [
      derivative,
    ]);
    expect(object).toEqual({ n: 1 });
  });

  it("issues no new link after the holder is suspended, and resumes once reinstated", async () => {
    const { derivative } = await publishOne("Holder suspended");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    try {
      const suspended = await visitor.storage
        .from("public-media")
        .createSignedUrl(derivative, ONE_HOUR_SECONDS);
      expect(suspended.error).not.toBeNull();
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
      );
    }
    const restored = await visitor.storage
      .from("public-media")
      .createSignedUrl(derivative, ONE_HOUR_SECONDS);
    expect(restored.error).toBeNull();
  });
});

describe("a link that was already issued", () => {
  it("keeps working after removal until its own expiry, which is the accepted residual window", async () => {
    const { update, derivative } = await publishOne("Residual window");
    const issued = await visitor.storage
      .from("public-media")
      .createSignedUrl(derivative, ONE_HOUR_SECONDS);
    expect(issued.error).toBeNull();

    expect((await alice.client.rpc("delete_update", { p_update_id: update })).error).toBeNull();

    // The token still carries its own expiry, so the link is served until that time, as documented.
    const response = await fetch(issued.data!.signedUrl);
    expect(response.status).toBe(200);
  });

  it("becomes unusable once its expiry has passed", async () => {
    const { derivative } = await publishOne("Short link");
    const brief = await visitor.storage.from("public-media").createSignedUrl(derivative, 1);
    expect(brief.error).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const response = await fetch(brief.data!.signedUrl);
    expect(response.ok).toBe(false);
  });
});
