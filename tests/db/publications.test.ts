import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  simulateHolderChange,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * Publication, the private boundary around it, public derivatives and Storage. Every check runs through
 * the database as a visitor, the holder, the author, another grower or a suspended grower. The Phase 3
 * private-documentation rules must still hold after an Update is published.
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser; // holder and author of the public seedling
let bob: TestUser; // another grower
let publicSeedling: string;
let privateSeedling: string;
let photoA: { observation: string; media: string; path: string };
let photoB: { media: string; path: string };
let videoC: { media: string; path: string };
let videoOnly: { observation: string; media: string };

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

async function uploadPrivate(user: TestUser, mime = "image/jpeg"): Promise<string> {
  const ext = mime === "video/mp4" ? "mp4" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = mime === "video/mp4" ? new Uint8Array(4096) : JPEG;
  const { error } = await user.client.storage
    .from("private-media")
    .upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: false });
  if (error) throw new Error(`private upload failed: ${error.message}`);
  return path;
}

/** A derivative as the publishing action would upload it: a WebP in the uploader's folder. */
async function uploadDerivative(user: TestUser): Promise<string> {
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error } = await user.client.storage
    .from("public-media")
    .upload(path, new Blob([WEBP], { type: "image/webp" }), {
      contentType: "image/webp",
      upsert: false,
    });
  if (error) throw new Error(`derivative upload failed: ${error.message}`);
  return path;
}

async function scalar(
  sql: string,
  params: unknown[],
): Promise<Record<string, unknown> | undefined> {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows[0]);
}

function item(mediaId: string, derivativePath: string) {
  return {
    media_id: mediaId,
    derivative_path: derivativePath,
    width: 1200,
    height: 800,
    byte_size: 2048,
  };
}

async function publish(
  user: TestUser,
  observation: string,
  items: ReturnType<typeof item>[],
  options: { key?: string; caption?: string | null } = {},
) {
  return user.client.rpc("publish_update", {
    p_observation_id: observation,
    p_client_key: options.key ?? crypto.randomUUID(),
    p_items: items,
    p_caption: options.caption ?? undefined,
  });
}

beforeAll(async () => {
  alice = await createTestUser("pub-alice");
  bob = await createTestUser("pub-bob");
  created.push(alice.id, bob.id);
  for (const user of [alice, bob]) {
    const profile = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: "Publisher", country_code: "BE" });
    expect(profile.error).toBeNull();
  }

  publicSeedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Public Ember",
      p_visibility: "public",
    })
  ).data!.id;
  privateSeedling = (await alice.client.rpc("create_seedling", { p_working_name: "Private Ember" }))
    .data!.id;

  // One observation with two images and one video, on the public seedling.
  const pathA = await uploadPrivate(alice);
  const pathB = await uploadPrivate(alice);
  const pathC = await uploadPrivate(alice, "video/mp4");
  const captured = await alice.client.rpc("capture_observation", {
    p_seedling_id: publicSeedling,
    p_new_seedling: false,
    p_note: "Private note, never published",
    p_voice_transcript: "Private transcript, never published",
    p_paths: [pathA, pathB, pathC],
  });
  expect(captured.error).toBeNull();
  const observation = captured.data!.id;
  const links = await withSuperuser(
    async (db) =>
      (
        await db.query(
          "select om.media_id, m.storage_path, m.kind from public.observation_media om join public.media m on m.id = om.media_id where om.observation_id = $1 order by om.sort_order",
          [observation],
        )
      ).rows,
  );
  const byKind = links.map((row) => ({
    media: row.media_id as string,
    path: row.storage_path as string,
    kind: row.kind as string,
  }));
  photoA = { observation, media: byKind[0]!.media, path: byKind[0]!.path };
  photoB = { media: byKind[1]!.media, path: byKind[1]!.path };
  videoC = { media: byKind[2]!.media, path: byKind[2]!.path };
  expect(byKind[2]!.kind).toBe("video");

  // An observation that only holds a video.
  const videoPath = await uploadPrivate(alice, "video/mp4");
  const videoCapture = await alice.client.rpc("capture_observation", {
    p_seedling_id: publicSeedling,
    p_new_seedling: false,
    p_paths: [videoPath],
  });
  const videoMedia = (await scalar(
    "select media_id from public.observation_media where observation_id = $1",
    [videoCapture.data!.id],
  )) as { media_id: string };
  videoOnly = { observation: videoCapture.data!.id, media: videoMedia.media_id };
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("deliberate publication", () => {
  it("publishes only the selected image, through its own public derivative", async () => {
    const derivative = await uploadDerivative(alice);
    const result = await publish(alice, photoA.observation, [item(photoA.media, derivative)], {
      caption: "First bloom of the season",
    });
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ created: true });

    const rows = await scalar(
      `select count(*)::int as n, min(d.storage_path) as path, min(d.source_media_id::text) as source
         from public.update_media um join public.public_derivatives d on d.id = um.derivative_id
        where um.update_id = $1`,
      [(result.data as { id: string }).id],
    );
    expect(rows).toMatchObject({ n: 1, path: derivative, source: photoA.media });
  });

  it("keeps the source observation, its note, transcript and structured data private", async () => {
    const view = await visitor.from("observations").select("id").eq("seedling_id", publicSeedling);
    expect(errorCode(view.error) === "42501" || (view.data ?? []).length === 0).toBe(true);
    const obs = await scalar(
      "select visibility::text as visibility, note, voice_transcript, structured_data from public.observations where id = $1",
      [photoA.observation],
    );
    expect(obs).toMatchObject({ visibility: "private", note: "Private note, never published" });
    expect(obs?.voice_transcript).toBe("Private transcript, never published");
  });

  it("keeps the private original of the published image private to visitors", async () => {
    const signed = await visitor.storage.from("private-media").createSignedUrl(photoA.path, 60);
    expect(signed.data?.signedUrl ?? null).toBeNull();
    expect(signed.error).not.toBeNull();
    const direct = await visitor.storage.from("private-media").download(photoA.path);
    expect(direct.error).not.toBeNull();
  });

  it("keeps unselected images and the video private, even with their exact paths and ids", async () => {
    for (const path of [photoB.path, videoC.path]) {
      const signed = await visitor.storage.from("private-media").createSignedUrl(path, 60);
      expect(signed.error).not.toBeNull();
    }
    const media = await visitor.from("media").select("id").in("id", [photoB.media, videoC.media]);
    expect(errorCode(media.error) === "42501" || (media.data ?? []).length === 0).toBe(true);
    const derivativesOfB = await scalar(
      "select count(*)::int as n from public.public_derivatives where source_media_id = $1",
      [photoB.media],
    );
    expect(derivativesOfB).toEqual({ n: 0 });
  });

  it("lets a visitor fetch the public derivative by signed URL, and nothing else", async () => {
    const derivative = (await scalar(
      "select storage_path from public.public_derivatives where source_media_id = $1",
      [photoA.media],
    )) as { storage_path: string };
    const signed = await visitor.storage
      .from("public-media")
      .createSignedUrl(derivative.storage_path, 60);
    expect(signed.error).toBeNull();
    expect(signed.data?.signedUrl).toBeTruthy();
    const response = await fetch(signed.data!.signedUrl);
    expect(response.status).toBe(200);
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
  });

  it("refuses the video: publication of a video is not available, even through a crafted call", async () => {
    const derivative = await uploadDerivative(alice);
    const attempt = await publish(alice, videoOnly.observation, [
      item(videoOnly.media, derivative),
    ]);
    expect(errorCode(attempt.error)).toBe("0A000");
    expect(attempt.error?.message).toBe("public video sharing is not available yet");
    const rows = await scalar(
      "select count(*)::int as n from public.updates where source_observation_id = $1",
      [videoOnly.observation],
    );
    expect(rows).toEqual({ n: 0 });
  });

  it("refuses a selection that is not part of the observation", async () => {
    const other = await alice.client.rpc("capture_observation", {
      p_seedling_id: publicSeedling,
      p_new_seedling: false,
      p_paths: [await uploadPrivate(alice)],
    });
    const foreign = (await scalar(
      "select media_id from public.observation_media where observation_id = $1",
      [other.data!.id],
    )) as { media_id: string };
    const derivative = await uploadDerivative(alice);
    const attempt = await publish(alice, photoA.observation, [item(foreign.media_id, derivative)]);
    expect(errorCode(attempt.error)).toBe("P0002");
  });

  it("refuses a derivative the caller did not upload, even when it exists", async () => {
    const bobsDerivative = await uploadDerivative(bob);
    const attempt = await publish(alice, photoA.observation, [item(photoB.media, bobsDerivative)]);
    expect(errorCode(attempt.error)).toBe("P0002");
    expect(attempt.error?.message).toBe("the prepared image is missing");
  });

  it("refuses a derivative that does not exist", async () => {
    const attempt = await publish(alice, photoA.observation, [
      item(photoB.media, `${alice.id}/${crypto.randomUUID()}.webp`),
    ]);
    expect(errorCode(attempt.error)).toBe("P0002");
  });

  it("refuses an empty selection, too many items, and an over-long caption", async () => {
    expect(errorCode((await publish(alice, photoA.observation, [])).error)).toBe("22023");
    const seven = Array.from({ length: 7 }, () => item(photoB.media, `${alice.id}/x.webp`));
    expect(errorCode((await publish(alice, photoA.observation, seven)).error)).toBe("22023");
    const derivative = await uploadDerivative(alice);
    const long = await publish(alice, photoA.observation, [item(photoB.media, derivative)], {
      caption: "x".repeat(2001),
    });
    expect(errorCode(long.error)).toBe("22001");
  });

  it("refuses a visitor and a suspended grower to publish", async () => {
    const derivative = await uploadDerivative(alice);
    const anonymous = await visitor.rpc("publish_update", {
      p_observation_id: photoA.observation,
      p_client_key: crypto.randomUUID(),
      p_items: [item(photoB.media, derivative)],
    });
    expect(errorCode(anonymous.error)).toBe("42501");
  });

  it("does not let a grower write Updates or derivatives directly", async () => {
    const direct = await alice.client.from("updates").insert({
      seedling_id: publicSeedling,
      author_id: alice.id,
      source_observation_id: photoA.observation,
      observed_at: new Date().toISOString(),
      client_key: crypto.randomUUID(),
    });
    expect(errorCode(direct.error)).toBe("42501");
    const derivative = await alice.client.from("public_derivatives").insert({
      source_media_id: photoB.media,
      owner_id: alice.id,
      storage_path: `${alice.id}/direct.webp`,
      byte_size: 10,
      width: 1,
      height: 1,
    });
    expect(errorCode(derivative.error)).toBe("42501");
  });
});

describe("repeated submissions", () => {
  it("publishes once when the same client key is submitted twice", async () => {
    const key = crypto.randomUUID();
    const first = await publish(
      alice,
      photoA.observation,
      [item(photoB.media, await uploadDerivative(alice))],
      {
        key,
      },
    );
    const second = await publish(
      alice,
      photoA.observation,
      [item(photoB.media, await uploadDerivative(alice))],
      {
        key,
      },
    );
    expect(first.data).toMatchObject({ created: true });
    expect(second.data).toMatchObject({ created: false, id: (first.data as { id: string }).id });
    const rows = await scalar(
      "select count(*)::int as n from public.updates where client_key = $1",
      [key],
    );
    expect(rows).toEqual({ n: 1 });
  });

  it("creates nothing when a publication fails part-way, and leaves no reference behind", async () => {
    const countOf = async () =>
      (await scalar(
        "select (select count(*) from public.public_derivatives)::int as derivatives, (select count(*) from public.updates where source_observation_id = $1)::int as updates",
        [photoA.observation],
      )) as { derivatives: number; updates: number };
    const before = await countOf();
    // The second item is a video, so the whole publication must roll back, including the first derivative.
    const failed = await publish(alice, photoA.observation, [
      item(photoB.media, await uploadDerivative(alice)),
      item(videoC.media, await uploadDerivative(alice)),
    ]);
    expect(errorCode(failed.error)).toBe("0A000");
    expect(await countOf()).toEqual(before);
  });
});

describe("the private-to-public seedling transition", () => {
  let privateObservation: string;
  let privateMedia: string;
  let privatePath: string;

  beforeAll(async () => {
    privatePath = await uploadPrivate(alice);
    const captured = await alice.client.rpc("capture_observation", {
      p_seedling_id: privateSeedling,
      p_new_seedling: false,
      p_note: "Nobody else should see this",
      p_paths: [privatePath],
    });
    privateObservation = captured.data!.id;
    privateMedia = (
      (await scalar("select media_id from public.observation_media where observation_id = $1", [
        privateObservation,
      ])) as { media_id: string }
    ).media_id;
  });

  it("refuses to publish while the seedling is private", async () => {
    const attempt = await publish(alice, privateObservation, [
      item(privateMedia, await uploadDerivative(alice)),
    ]);
    expect(errorCode(attempt.error)).toBe("23514");
    expect(attempt.error?.message).toBe("the seedling must be public before it can be shared");
  });

  it("makes the seedling public without exposing its private observation or media", async () => {
    const changed = await alice.client
      .from("seedlings")
      .update({ visibility: "public" })
      .eq("id", privateSeedling)
      .select("id");
    expect(changed.error).toBeNull();
    expect(changed.data).toHaveLength(1);

    const seedling = await visitor.from("seedlings").select("id").eq("id", privateSeedling);
    expect(seedling.data).toHaveLength(1);
    const obs = await visitor.from("observations").select("id").eq("id", privateObservation);
    expect(refused(obs)).toBe(true);
    const signed = await visitor.storage.from("private-media").createSignedUrl(privatePath, 60);
    expect(signed.error).not.toBeNull();
  });

  it("publishes one image after the transition, and still keeps the observation private", async () => {
    const attempt = await publish(
      alice,
      privateObservation,
      [item(privateMedia, await uploadDerivative(alice))],
      {
        caption: "Ready to share",
      },
    );
    expect(attempt.error).toBeNull();
    const obs = await visitor.from("observations").select("id").eq("id", privateObservation);
    expect(refused(obs)).toBe(true);
    const signed = await visitor.storage.from("private-media").createSignedUrl(privatePath, 60);
    expect(signed.error).not.toBeNull();
  });
});

describe("publication authority", () => {
  it("refuses publication by a former holder once the seedling changes hands", async () => {
    const pubKey = crypto.randomUUID();
    await simulateHolderChange(publicSeedling, bob.id);
    try {
      const attempt = await publish(
        alice,
        photoA.observation,
        [item(photoB.media, await uploadDerivative(alice))],
        {
          key: pubKey,
        },
      );
      expect(errorCode(attempt.error)).toBe("42501");
      expect(attempt.error?.message).toBe("only the current holder can publish");
      // Another grower cannot publish the former holder's private observation either.
      const bobs = await publish(bob, photoA.observation, [
        item(photoB.media, await uploadDerivative(bob)),
      ]);
      expect(errorCode(bobs.error)).toBe("P0002");
    } finally {
      await simulateHolderChange(publicSeedling, alice.id);
    }
  });

  it("refuses publication by a suspended current holder", async () => {
    const derivative = await uploadDerivative(alice);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    try {
      const attempt = await publish(alice, photoA.observation, [item(photoB.media, derivative)]);
      expect(errorCode(attempt.error)).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
      );
    }
  });
});

describe("deleting an Update", () => {
  it("removes the Update from public reads, retires its derivative and leaves the original private and intact", async () => {
    const derivative = await uploadDerivative(alice);
    const published = await publish(alice, photoA.observation, [item(photoB.media, derivative)]);
    const updateId = (published.data as { id: string }).id;
    const visible = await visitor.from("updates").select("id").eq("id", updateId);
    expect(visible.data).toHaveLength(1);

    const deleted = await alice.client.rpc("delete_update", { p_update_id: updateId });
    expect(deleted.error).toBeNull();

    const gone = await visitor.from("updates").select("id").eq("id", updateId);
    expect(gone.data).toEqual([]);
    const retired = await scalar(
      "select deleted_at is not null as gone from public.public_derivatives where storage_path = $1",
      [derivative],
    );
    expect(retired).toEqual({ gone: true });
    const signed = await visitor.storage.from("public-media").createSignedUrl(derivative, 60);
    expect(signed.error).not.toBeNull();

    // The source observation and its original are untouched.
    const obs = await scalar(
      "select deleted_at is null as live from public.observations where id = $1",
      [photoA.observation],
    );
    expect(obs).toEqual({ live: true });
    const original = await alice.client.storage.from("private-media").download(photoB.path);
    expect(original.error).toBeNull();
  });

  it("refuses another grower deleting an Update", async () => {
    const published = await publish(alice, photoA.observation, [
      item(photoB.media, await uploadDerivative(alice)),
    ]);
    const attempt = await bob.client.rpc("delete_update", {
      p_update_id: (published.data as { id: string }).id,
    });
    expect(attempt.error?.message).toBe("update not found");
  });
});

describe("public-media Storage boundary", () => {
  it("keeps the public-media bucket private, with the approved type and size", async () => {
    const bucket = await scalar(
      "select public, file_size_limit::int as limit, allowed_mime_types from storage.buckets where id = 'public-media'",
      [],
    );
    expect(bucket?.public).toBe(false);
    expect(bucket?.limit).toBe(5242880);
    expect(bucket?.allowed_mime_types).toEqual(["image/webp"]);
  });

  it("refuses a visitor the exact path of an unpublished derivative", async () => {
    const path = await uploadDerivative(alice);
    const signed = await visitor.storage.from("public-media").createSignedUrl(path, 60);
    expect(signed.error).not.toBeNull();
    const download = await visitor.storage.from("public-media").download(path);
    expect(download.error).not.toBeNull();
  });

  it("lets the owner remove an unregistered upload, but never a registered derivative", async () => {
    const orphan = await uploadDerivative(alice);
    await alice.client.storage.from("public-media").remove([orphan]);
    const orphanRows = await scalar(
      "select count(*)::int as n from storage.objects where name = $1",
      [orphan],
    );
    expect(orphanRows).toEqual({ n: 0 });

    const published = await publish(alice, photoA.observation, [
      item(photoB.media, await uploadDerivative(alice)),
    ]);
    const registered = (await scalar(
      "select storage_path from public.public_derivatives d join public.update_media um on um.derivative_id = d.id where um.update_id = $1",
      [(published.data as { id: string }).id],
    )) as { storage_path: string };
    await alice.client.storage.from("public-media").remove([registered.storage_path]);
    const stillThere = await scalar(
      "select count(*)::int as n from storage.objects where name = $1",
      [registered.storage_path],
    );
    expect(stillThere).toEqual({ n: 1 });
  });

  it("refuses another grower reading or removing an unpublished upload", async () => {
    const path = await uploadDerivative(alice);
    const read = await bob.client.storage.from("public-media").createSignedUrl(path, 60);
    expect(read.error).not.toBeNull();
    await bob.client.storage.from("public-media").remove([path]);
    const still = await scalar("select count(*)::int as n from storage.objects where name = $1", [
      path,
    ]);
    expect(still).toEqual({ n: 1 });
  });

  it("refuses a private original through the public-media bucket, even with its exact path", async () => {
    const read = await visitor.storage.from("public-media").createSignedUrl(photoB.path, 60);
    expect(read.error).not.toBeNull();
  });
});

describe("the public cover", () => {
  let coverSeedling: string;
  let older: string;
  let newer: string;

  beforeAll(async () => {
    coverSeedling = (
      await alice.client.rpc("create_seedling", {
        p_working_name: "Cover Ember",
        p_visibility: "public",
      })
    ).data!.id;
    const mediaOf = async (observation: string) =>
      (
        (await scalar("select media_id from public.observation_media where observation_id = $1", [
          observation,
        ])) as {
          media_id: string;
        }
      ).media_id;
    const derivativeOf = async (media: string) =>
      (
        (await scalar("select id from public.public_derivatives where source_media_id = $1", [
          media,
        ])) as { id: string }
      ).id;

    const first = await alice.client.rpc("capture_observation", {
      p_seedling_id: coverSeedling,
      p_new_seedling: false,
      p_paths: [await uploadPrivate(alice)],
    });
    expect(
      (
        await publish(alice, first.data!.id, [
          item(await mediaOf(first.data!.id), await uploadDerivative(alice)),
        ])
      ).error,
    ).toBeNull();
    older = await derivativeOf(await mediaOf(first.data!.id));

    // The second image is shared later, so it becomes the default cover.
    const second = await alice.client.rpc("capture_observation", {
      p_seedling_id: coverSeedling,
      p_new_seedling: false,
      p_paths: [await uploadPrivate(alice)],
    });
    expect(
      (
        await publish(alice, second.data!.id, [
          item(await mediaOf(second.data!.id), await uploadDerivative(alice)),
        ])
      ).error,
    ).toBeNull();
    newer = await derivativeOf(await mediaOf(second.data!.id));
  });

  it("uses the most recently shared image as the default cover", async () => {
    const cover = await scalar("select public.seedling_cover($1) as id", [coverSeedling]);
    expect(cover).toEqual({ id: newer });
  });

  it("lets the holder choose an older public image as the cover, and restores the default when cleared", async () => {
    expect(
      (
        await alice.client.rpc("set_seedling_cover", {
          p_seedling_id: coverSeedling,
          p_derivative_id: older,
        })
      ).error,
    ).toBeNull();
    expect(await scalar("select public.seedling_cover($1) as id", [coverSeedling])).toEqual({
      id: older,
    });
    await alice.client.rpc("set_seedling_cover", { p_seedling_id: coverSeedling });
    expect(await scalar("select public.seedling_cover($1) as id", [coverSeedling])).toEqual({
      id: newer,
    });
  });

  it("refuses a cover from another seedling, and refuses a cover chosen by a non-holder", async () => {
    const otherSeedling = (
      await alice.client.rpc("create_seedling", { p_working_name: "Other", p_visibility: "public" })
    ).data!.id;
    const elsewhere = await alice.client.rpc("set_seedling_cover", {
      p_seedling_id: otherSeedling,
      p_derivative_id: newer,
    });
    expect(errorCode(elsewhere.error)).toBe("23514");
    const notHolder = await bob.client.rpc("set_seedling_cover", {
      p_seedling_id: coverSeedling,
      p_derivative_id: newer,
    });
    expect(errorCode(notHolder.error)).toBe("P0002");
  });

  it("falls back to the default when the chosen cover's Update is deleted", async () => {
    await alice.client.rpc("set_seedling_cover", {
      p_seedling_id: coverSeedling,
      p_derivative_id: older,
    });
    const updateOfOlder = (await scalar(
      "select update_id from public.update_media where derivative_id = $1",
      [older],
    )) as { update_id: string };
    await alice.client.rpc("delete_update", { p_update_id: updateOfOlder.update_id });
    expect(await scalar("select public.seedling_cover($1) as id", [coverSeedling])).toEqual({
      id: newer,
    });
  });
});

function refused(result: { data: unknown[] | null; error: { code?: string } | null }): boolean {
  return result.error !== null ? result.error.code === "42501" : (result.data ?? []).length === 0;
}
