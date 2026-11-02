import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  localSupabase,
  removeTestUsers,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * Storage boundary for private originals. Every test goes through Supabase Storage itself, with the same
 * session a browser or the delivery route would use, or through a direct object URL. Storage policies are
 * tested independently of any Observation UI.
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let dana: TestUser;
let alicePhotoPath: string;
let aliceCapturedMediaPath: string;

function bytes(size: number, type: string): Blob {
  const data = new Uint8Array(size);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([data], { type });
}

async function uploadAs(user: TestUser, mime: string, size = 2048): Promise<string> {
  const ext = mime === "image/png" ? "png" : mime === "video/mp4" ? "mp4" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await user.client.storage
    .from("private-media")
    .upload(path, bytes(size, mime), {
      contentType: mime,
      upsert: false,
    });
  if (error) throw new Error(`upload setup failed: ${error.message}`);
  return path;
}

async function directStatus(
  path: string,
  prefix: "object" | "object/public",
  token?: string,
): Promise<number> {
  const { apiUrl, publishableKey } = localSupabase();
  const response = await fetch(`${apiUrl}/storage/v1/${prefix}/private-media/${path}`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${token ?? publishableKey}` },
  });
  return response.status;
}

beforeAll(async () => {
  alice = await createTestUser("media-alice");
  bob = await createTestUser("media-bob");
  dana = await createTestUser("media-dana");
  created.push(alice.id, bob.id, dana.id);
  for (const user of [alice, bob, dana]) {
    const profile = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: "Media Test", country_code: "NL" });
    expect(profile.error).toBeNull();
  }

  alicePhotoPath = await uploadAs(alice, "image/jpeg");

  // Make one registered capture so there is live media to test against.
  const captured = await alice.client.rpc("capture_observation", {
    p_new_seedling: true,
    p_paths: [alicePhotoPath],
  });
  expect(captured.error).toBeNull();
  aliceCapturedMediaPath = alicePhotoPath;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("uploads", () => {
  it("lets a grower upload into their own folder", async () => {
    const path = `${alice.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await alice.client.storage
      .from("private-media")
      .upload(path, bytes(1024, "image/jpeg"), {
        contentType: "image/jpeg",
      });
    expect(error).toBeNull();
  });

  it("refuses an upload into another grower's folder", async () => {
    const { error } = await bob.client.storage
      .from("private-media")
      .upload(`${alice.id}/${crypto.randomUUID()}.jpg`, bytes(1024, "image/jpeg"), {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
  });

  it("refuses an anonymous upload", async () => {
    const { error } = await visitor.storage
      .from("private-media")
      .upload(`${alice.id}/${crypto.randomUUID()}.jpg`, bytes(1024, "image/jpeg"), {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
  });

  it("refuses a suspended grower's upload", async () => {
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [dana.id]),
    );
    const { error } = await dana.client.storage
      .from("private-media")
      .upload(`${dana.id}/${crypto.randomUUID()}.jpg`, bytes(1024, "image/jpeg"), {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [dana.id]),
    );
  });

  it("refuses a file type the bucket does not allow", async () => {
    const { error } = await alice.client.storage
      .from("private-media")
      .upload(
        `${alice.id}/${crypto.randomUUID()}.txt`,
        new Blob(["text"], { type: "text/plain" }),
        {
          contentType: "text/plain",
        },
      );
    expect(error).not.toBeNull();
  });

  it("allows an over-limit photo to be uploaded, but refuses to register it as media", async () => {
    const path = await uploadAs(alice, "image/jpeg", 16 * 1024 * 1024);
    const { error } = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [path],
    });
    expect(errorCode(error)).toBe("23514");
    expect(error?.message).toContain("larger than");
  });
});

describe("private originals", () => {
  it("does not expose an original through the public storage URL", async () => {
    expect(await directStatus(aliceCapturedMediaPath, "object/public")).not.toBe(200);
  });

  it("refuses a visitor the exact path", async () => {
    const { error } = await visitor.storage.from("private-media").download(aliceCapturedMediaPath);
    expect(error).not.toBeNull();
  });

  it("refuses another grower the exact path", async () => {
    const { error } = await bob.client.storage
      .from("private-media")
      .download(aliceCapturedMediaPath);
    expect(error).not.toBeNull();
    expect(
      await directStatus(
        aliceCapturedMediaPath,
        "object",
        (await bob.client.auth.getSession()).data.session?.access_token,
      ),
    ).toBeGreaterThanOrEqual(400);
  });

  it("refuses an unauthenticated direct object request", async () => {
    expect(await directStatus(aliceCapturedMediaPath, "object")).toBeGreaterThanOrEqual(400);
  });

  it("lets the owner download a registered original", async () => {
    const { data, error } = await alice.client.storage
      .from("private-media")
      .download(aliceCapturedMediaPath);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("lets the owner read their own upload that never became media, so they can remove it", async () => {
    const pending = await uploadAs(alice, "image/jpeg");
    const pendingRead = await alice.client.storage.from("private-media").download(pending);
    expect(pendingRead.error).toBeNull();
  });
});

describe("signed delivery", () => {
  it("gives the owner a short-lived signed URL that serves the bytes", async () => {
    const { data, error } = await alice.client.storage
      .from("private-media")
      .createSignedUrl(aliceCapturedMediaPath, 60);
    expect(error).toBeNull();
    const response = await fetch(data!.signedUrl);
    expect(response.status).toBe(200);
  });

  it("refuses a signed URL to a visitor or another grower", async () => {
    const visitorSigned = await visitor.storage
      .from("private-media")
      .createSignedUrl(aliceCapturedMediaPath, 60);
    expect(visitorSigned.error).not.toBeNull();
    const bobSigned = await bob.client.storage
      .from("private-media")
      .createSignedUrl(aliceCapturedMediaPath, 60);
    expect(bobSigned.error).not.toBeNull();
  });
});

describe("removal", () => {
  it("lets the owner remove an upload that never became media", async () => {
    const pending = await uploadAs(alice, "image/jpeg");
    const { error } = await alice.client.storage.from("private-media").remove([pending]);
    expect(error).toBeNull();
    // The API reports removals through the select policy, so check the object table directly.
    const left = await withSuperuser((db) =>
      db.query("select count(*)::int as n from storage.objects where name = $1", [pending]),
    );
    expect(left.rows[0]?.n).toBe(0);
  });

  it("refuses removing registered media through storage", async () => {
    const { data } = await alice.client.storage
      .from("private-media")
      .remove([aliceCapturedMediaPath]);
    expect(data ?? []).toEqual([]);
    const still = await withSuperuser((db) =>
      db.query("select count(*)::int as n from storage.objects where name = $1", [
        aliceCapturedMediaPath,
      ]),
    );
    expect(still.rows[0]?.n).toBe(1);
  });

  it("refuses another grower removing an upload", async () => {
    const pending = await uploadAs(alice, "image/jpeg");
    const { data } = await bob.client.storage.from("private-media").remove([pending]);
    expect(data ?? []).toEqual([]);
  });
});

describe("bucket configuration", () => {
  it("is private, with the approved size limit and MIME list", async () => {
    const result = await withSuperuser((db) =>
      db.query(
        "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'private-media'",
      ),
    );
    const row = result.rows[0];
    expect(row?.public).toBe(false);
    expect(Number(row?.file_size_limit)).toBe(52428800);
    expect([...row!.allowed_mime_types].sort()).toEqual(
      [
        "image/heic",
        "image/heif",
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "video/webm",
      ].sort(),
    );
  });
});
