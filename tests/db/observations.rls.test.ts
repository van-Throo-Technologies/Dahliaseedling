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
 * Observation permissions, capture, correction and deletion, tested through the database as a visitor,
 * a grower, another grower and a suspended grower. Observations are private to their author, whatever the
 * visibility of the seedling they belong to.
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let dana: TestUser;
let publicSeedling: string;
let privateSeedling: string;
let bobSeedling: string;
let observationOnPublic: string;
let observationNew: string;
let mediaOnPublic: string;

async function uploadAs(user: TestUser, mime = "image/jpeg", size = 2048): Promise<string> {
  const ext = mime === "video/mp4" ? "mp4" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const data = new Uint8Array(size);
  data.set([0xff, 0xd8, 0xff]);
  const { error } = await user.client.storage
    .from("private-media")
    .upload(path, new Blob([data], { type: mime }), {
      contentType: mime,
      upsert: false,
    });
  if (error) throw new Error(`upload setup failed: ${error.message}`);
  return path;
}

/** True when a read was refused: either no rows, or a permission error (no grant, or RLS). */
function refused(result: { data: unknown[] | null; error: { code?: string } | null }): boolean {
  return result.error !== null ? result.error.code === "42501" : (result.data ?? []).length === 0;
}

async function scalar(sql: string, params: unknown[]): Promise<unknown> {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows[0]);
}

beforeAll(async () => {
  alice = await createTestUser("obs-alice");
  bob = await createTestUser("obs-bob");
  dana = await createTestUser("obs-dana");
  created.push(alice.id, bob.id, dana.id);
  for (const user of [alice, bob, dana]) {
    const profile = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: "Observer", country_code: "BE" });
    expect(profile.error).toBeNull();
  }

  const pub = await alice.client.rpc("create_seedling", {
    p_working_name: "Public Ember",
    p_visibility: "public",
  });
  publicSeedling = pub.data!.id;
  const priv = await alice.client.rpc("create_seedling", { p_working_name: "Private Ember" });
  privateSeedling = priv.data!.id;
  const other = await bob.client.rpc("create_seedling", { p_working_name: "Bob Ember" });
  bobSeedling = other.data!.id;

  // Alice captures a private observation with a private photo onto her public seedling.
  mediaOnPublic = await uploadAs(alice);
  const captured = await alice.client.rpc("capture_observation", {
    p_seedling_id: publicSeedling,
    p_new_seedling: false,
    p_note: "Opened this morning",
    p_paths: [mediaOnPublic],
  });
  expect(captured.error).toBeNull();
  observationOnPublic = captured.data!.id;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the mandatory privacy path: a public seedling does not expose its private observation", () => {
  it("lets a visitor open the public seedling", async () => {
    const { data } = await visitor
      .from("seedlings")
      .select("id, working_name")
      .eq("id", publicSeedling);
    expect(data).toEqual([{ id: publicSeedling, working_name: "Public Ember" }]);
  });

  it("does not let a visitor read the observation on that seedling", async () => {
    expect(
      refused(await visitor.from("observations").select("id").eq("id", observationOnPublic)),
    ).toBe(true);
    expect(
      refused(await visitor.from("observations").select("id").eq("seedling_id", publicSeedling)),
    ).toBe(true);
  });

  it("does not let a visitor retrieve its media, even with the exact media id", async () => {
    expect(
      refused(await visitor.from("media").select("id").eq("storage_path", mediaOnPublic)),
    ).toBe(true);
    expect(
      refused(
        await visitor
          .from("observation_media")
          .select("media_id")
          .eq("observation_id", observationOnPublic),
      ),
    ).toBe(true);
  });

  it("does not let another grower read the observation or its media because the seedling is public", async () => {
    const observation = await bob.client
      .from("observations")
      .select("id")
      .eq("id", observationOnPublic);
    expect(observation.data).toEqual([]);
    const media = await bob.client.from("media").select("id").eq("storage_path", mediaOnPublic);
    expect(media.data).toEqual([]);
  });

  it("lets the author read the observation and its media", async () => {
    const observation = await alice.client
      .from("observations")
      .select("id, note")
      .eq("id", observationOnPublic);
    expect(observation.data).toEqual([{ id: observationOnPublic, note: "Opened this morning" }]);
    const media = await alice.client.from("media").select("id").eq("storage_path", mediaOnPublic);
    expect(media.data).toHaveLength(1);
    mediaOnPublic = media.data![0]!.id as unknown as string;
  });
});

describe("capture", () => {
  it("creates a new seedling and attaches the observation, with the media linked in order", async () => {
    const paths = [await uploadAs(alice), await uploadAs(alice, "video/mp4")];
    const captured = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: paths,
    });
    expect(captured.error).toBeNull();
    observationNew = captured.data!.id;
    const seedling = captured.data!.seedling_id;
    expect(seedling).toBeTruthy();

    const links = await withSuperuser((db) =>
      db.query(
        "select m.storage_path, m.kind, om.sort_order from public.observation_media om join public.media m on m.id = om.media_id where om.observation_id = $1 order by om.sort_order",
        [observationNew],
      ),
    );
    expect(links.rows.map((row) => row.storage_path)).toEqual(paths);
    expect(links.rows.map((row) => row.kind)).toEqual(["image", "video"]);
    expect(links.rows.map((row) => row.sort_order)).toEqual([0, 1]);
  });

  it("defaults the observed time to the time of the capture, and keeps an earlier time as given", async () => {
    const now = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [await uploadAs(alice)],
    });
    expect(Math.abs(Date.parse(now.data!.observed_at) - Date.now())).toBeLessThan(60_000);

    const earlier = "2026-10-01T09:15:00.000Z";
    const past = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_observed_at: earlier,
      p_paths: [await uploadAs(alice)],
    });
    expect(new Date(past.data!.observed_at).toISOString()).toBe(earlier);
  });

  it("attaches to a seedling the grower holds, and never to someone else's", async () => {
    const ok = await alice.client.rpc("capture_observation", {
      p_seedling_id: publicSeedling,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    expect(ok.data?.seedling_id).toBe(publicSeedling);

    const bobs = await alice.client.rpc("capture_observation", {
      p_seedling_id: bobSeedling,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    expect(errorCode(bobs.error)).toBe("P0002");
    expect(bobs.error?.message).toBe("seedling not found");

    const missing = await alice.client.rpc("capture_observation", {
      p_seedling_id: "00000000-0000-4000-8000-000000000000",
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    expect(missing.error?.message).toBe("seedling not found");
  });

  it("does not let an inaccessible private seedling be identified differently from a missing one", async () => {
    const privateOfBob = await bob.client.rpc("create_seedling", { p_working_name: "Bob Private" });
    const attempt = await alice.client.rpc("capture_observation", {
      p_seedling_id: privateOfBob.data!.id,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    expect(attempt.error?.message).toBe("seedling not found");
  });

  it("returns the same observation when the same uploads are submitted twice", async () => {
    const path = await uploadAs(alice);
    const first = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [path],
    });
    const second = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [path],
    });
    expect(first.error).toBeNull();
    expect(second.data?.id).toBe(first.data?.id);
    expect(second.data?.seedling_id).toBe(first.data?.seedling_id);
  });

  it("creates no seedling and no observation when a capture fails part-way", async () => {
    const before = (await scalar(
      "select count(*)::int as n from public.seedlings where originator_id = $1",
      [alice.id],
    )) as { n: number };
    const good = await uploadAs(alice);
    const failed = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [good, `${alice.id}/${crypto.randomUUID()}.jpg`],
    });
    expect(failed.error).not.toBeNull();
    const after = (await scalar(
      "select count(*)::int as n from public.seedlings where originator_id = $1",
      [alice.id],
    )) as { n: number };
    expect(after.n).toBe(before.n);
    const orphan = await withSuperuser((db) =>
      db.query("select count(*)::int as n from public.media where storage_path = $1", [good]),
    );
    expect(orphan.rows[0]?.n).toBe(0);
  });

  it("refuses a file that belongs to another grower", async () => {
    const theirs = await bob.client.storage
      .from("private-media")
      .upload(
        `${bob.id}/${crypto.randomUUID()}.jpg`,
        new Blob([new Uint8Array(8)], { type: "image/jpeg" }),
        {
          contentType: "image/jpeg",
        },
      );
    expect(theirs.error).toBeNull();
    const attempt = await alice.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [`${bob.id}/${(theirs.data?.path ?? "").split("/").pop()}`],
    });
    expect(errorCode(attempt.error)).toBe("42501");
  });

  it("refuses too many files, a repeated file, an oversize note and a future observed time", async () => {
    const seven = Array.from({ length: 7 }, () => `${alice.id}/${crypto.randomUUID()}.jpg`);
    expect(
      errorCode(
        (await alice.client.rpc("capture_observation", { p_new_seedling: true, p_paths: seven }))
          .error,
      ),
    ).toBe("23514");
    const path = await uploadAs(alice);
    expect(
      errorCode(
        (
          await alice.client.rpc("capture_observation", {
            p_new_seedling: true,
            p_paths: [path, path],
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await alice.client.rpc("capture_observation", {
            p_new_seedling: true,
            p_note: "x".repeat(2001),
            p_paths: [await uploadAs(alice)],
          })
        ).error,
      ),
    ).toBe("23514");
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      errorCode(
        (
          await alice.client.rpc("capture_observation", {
            p_new_seedling: true,
            p_observed_at: future,
            p_paths: [await uploadAs(alice)],
          })
        ).error,
      ),
    ).toBe("23514");
  });

  it("refuses a visitor and a suspended grower", async () => {
    const visitorAttempt = await visitor.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [await uploadAs(alice)],
    });
    expect(errorCode(visitorAttempt.error)).toBe("42501");

    // Upload while still active: a suspended grower cannot upload either (see the storage tests).
    const danaPath = await uploadAs(dana);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [dana.id]),
    );
    const suspended = await dana.client.rpc("capture_observation", {
      p_new_seedling: true,
      p_paths: [danaPath],
    });
    expect(errorCode(suspended.error)).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [dana.id]),
    );
  });
});

describe("authorship and editing", () => {
  it("lets the author change the note", async () => {
    const { data, error } = await alice.client
      .from("observations")
      .update({ note: "Corrected note" })
      .eq("id", observationOnPublic)
      .select("note");
    expect(error).toBeNull();
    expect(data).toEqual([{ note: "Corrected note" }]);
  });

  it("does not let another grower change the note", async () => {
    const { data } = await bob.client
      .from("observations")
      .update({ note: "Hijacked" })
      .eq("id", observationOnPublic)
      .select("id");
    expect(data).toEqual([]);
  });

  it("refuses a visitor any change", async () => {
    const { error } = await visitor
      .from("observations")
      .update({ note: "x" })
      .eq("id", observationOnPublic);
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses rewriting the author, the seedling directly, or the visibility", async () => {
    expect(
      errorCode(
        (
          await alice.client
            .from("observations")
            .update({ author_id: bob.id })
            .eq("id", observationOnPublic)
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client
            .from("observations")
            .update({ seedling_id: bobSeedling })
            .eq("id", observationOnPublic)
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client
            .from("observations")
            .update({ visibility: "public" })
            .eq("id", observationOnPublic)
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client
            .from("observation_media")
            .insert({ observation_id: observationOnPublic, media_id: mediaOnPublic })
        ).error,
      ),
    ).toBe("42501");
  });

  it("refuses a dictation transcript being rewritten after capture", async () => {
    const { error } = await alice.client
      .from("observations")
      .update({ voice_transcript: "changed" } as never)
      .eq("id", observationOnPublic);
    expect(error).not.toBeNull();
  });

  it("refuses a future observed time on edit", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error } = await alice.client
      .from("observations")
      .update({ observed_at: future })
      .eq("id", observationOnPublic);
    expect(errorCode(error)).toBe("23514");
  });

  it("refuses a suspended author any edit, but still reads the observation", async () => {
    const captured = await alice.client.rpc("capture_observation", {
      p_seedling_id: publicSeedling,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    const id = captured.data!.id;
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    const read = await alice.client.from("observations").select("id").eq("id", id);
    expect(read.data).toEqual([{ id }]);
    const edit = await alice.client
      .from("observations")
      .update({ note: "blocked" })
      .eq("id", id)
      .select("id");
    expect(edit.data).toEqual([]);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
    );
  });
});

describe("correction: Change moves the observation without re-uploading", () => {
  it("moves an observation to another seedling the grower holds, keeping ids, media and storage path", async () => {
    const before = (await scalar(
      "select m.id, m.storage_path from public.observation_media om join public.media m on m.id = om.media_id where om.observation_id = $1",
      [observationNew],
    )) as { id: string; storage_path: string };
    const objectsBefore = (await scalar(
      "select count(*)::int as n from storage.objects where bucket_id = 'private-media'",
      [],
    )) as { n: number };
    const moved = await alice.client.rpc("move_observation", {
      p_observation_id: observationNew,
      p_target_seedling_id: publicSeedling,
      p_new_seedling: false,
    });
    expect(moved.error).toBeNull();
    expect(moved.data?.id).toBe(observationNew);
    expect(moved.data?.seedling_id).toBe(publicSeedling);

    const after = (await scalar(
      "select m.id, m.storage_path from public.observation_media om join public.media m on m.id = om.media_id where om.observation_id = $1",
      [observationNew],
    )) as { id: string; storage_path: string };
    expect(after).toEqual(before);
    const objectsAfter = (await scalar(
      "select count(*)::int as n from storage.objects where bucket_id = 'private-media'",
      [],
    )) as { n: number };
    expect(objectsAfter.n).toBe(objectsBefore.n);
  });

  it("no longer shows the observation on the seedling it left, and shows it on the one it joined", async () => {
    const left = await withSuperuser((db) =>
      db.query(
        "select count(*)::int as n from public.observations where seedling_id = $1 and id = $2",
        [privateSeedling, observationNew],
      ),
    );
    expect(left.rows[0]?.n).toBe(0);
    const joined = await alice.client
      .from("observations")
      .select("id")
      .eq("seedling_id", publicSeedling)
      .eq("id", observationNew);
    expect(joined.data).toHaveLength(1);
  });

  it("moves an observation to a new seedling in the same step, without a metadata form", async () => {
    const moved = await alice.client.rpc("move_observation", {
      p_observation_id: observationNew,
      p_new_seedling: true,
    });
    expect(moved.error).toBeNull();
    expect(moved.data?.seedling_id).not.toBe(publicSeedling);
    const seedling = await alice.client
      .from("seedlings")
      .select("id")
      .eq("id", moved.data!.seedling_id);
    expect(seedling.data).toHaveLength(1);
  });

  it("refuses moving to another grower's seedling, to an inaccessible private one, or by another grower", async () => {
    expect(
      (
        await alice.client.rpc("move_observation", {
          p_observation_id: observationNew,
          p_target_seedling_id: bobSeedling,
          p_new_seedling: false,
        })
      ).error?.message,
    ).toBe("seedling not found");
    const bobPrivate = await bob.client.rpc("create_seedling", { p_working_name: "Still Bob" });
    expect(
      (
        await alice.client.rpc("move_observation", {
          p_observation_id: observationNew,
          p_target_seedling_id: bobPrivate.data!.id,
          p_new_seedling: false,
        })
      ).error?.message,
    ).toBe("seedling not found");
    expect(
      (
        await bob.client.rpc("move_observation", {
          p_observation_id: observationNew,
          p_target_seedling_id: bobSeedling,
          p_new_seedling: false,
        })
      ).error?.message,
    ).toBe("observation not found");
  });

  it("refuses a suspended grower moving an observation", async () => {
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    const attempt = await alice.client.rpc("move_observation", {
      p_observation_id: observationNew,
      p_target_seedling_id: publicSeedling,
      p_new_seedling: false,
    });
    expect(errorCode(attempt.error)).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
    );
  });
});

describe("deletion", () => {
  it("soft-deletes an observation and its media, removing both from normal views", async () => {
    const captured = await alice.client.rpc("capture_observation", {
      p_seedling_id: publicSeedling,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    const id = captured.data!.id;
    const mediaId = (await scalar(
      "select media_id from public.observation_media where observation_id = $1",
      [id],
    )) as { media_id: string };
    const deleted = await alice.client.rpc("delete_observation", { p_observation_id: id });
    expect(deleted.error).toBeNull();
    const view = await alice.client.from("observations").select("id").eq("id", id);
    expect(view.data).toEqual([]);
    const media = await alice.client.from("media").select("id").eq("id", mediaId.media_id);
    expect(media.data).toEqual([]);
    const row = (await scalar(
      "select deleted_at is not null as gone from public.observations where id = $1",
      [id],
    )) as { gone: boolean };
    expect(row.gone).toBe(true);
  });

  it("refuses another grower deleting it, and refuses a suspended author", async () => {
    expect(
      (await bob.client.rpc("delete_observation", { p_observation_id: observationOnPublic })).error
        ?.message,
    ).toBe("observation not found");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    expect(
      errorCode(
        (await alice.client.rpc("delete_observation", { p_observation_id: observationOnPublic }))
          .error,
      ),
    ).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
    );
  });

  it("never hard-deletes an observation or its media, even for a privileged role", async () => {
    await expect(
      withSuperuser((db) =>
        db.query("delete from public.observations where id = $1", [observationOnPublic]),
      ),
    ).rejects.toThrow(/soft-deleted/);
    const media = (await scalar("select id from public.media where owner_id = $1 limit 1", [
      alice.id,
    ])) as { id: string };
    await expect(
      withSuperuser((db) => db.query("delete from public.media where id = $1", [media.id])),
    ).rejects.toThrow(/soft-deleted/);
  });

  it("refuses changing a media file's identity or original", async () => {
    await expect(
      withSuperuser((db) =>
        db.query("update public.media set storage_path = 'other/x.jpg' where owner_id = $1", [
          alice.id,
        ]),
      ),
    ).rejects.toThrow(/never change/);
  });
});

describe("observation link visibility", () => {
  it("does not expose another grower's observation links", async () => {
    const links = await bob.client
      .from("observation_media")
      .select("media_id")
      .eq("observation_id", observationNew);
    expect(links.data).toEqual([]);
  });
});

describe("holder authority: Capture and editing follow the current holder", () => {
  let handover: string;
  let holderObservation: string;

  beforeAll(async () => {
    const seedling = await alice.client.rpc("create_seedling", {
      p_working_name: "Handover Ember",
      p_visibility: "public",
    });
    handover = seedling.data!.id;
  });

  it("refuses a grower who does not hold a public seedling, and writes nothing", async () => {
    const attempt = await bob.client.rpc("capture_observation", {
      p_seedling_id: publicSeedling,
      p_new_seedling: false,
      p_paths: [await uploadAs(bob)],
    });
    expect(attempt.error?.message).toBe("seedling not found");
    expect(
      (await scalar(
        "select count(*)::int as n from public.observations where seedling_id = $1 and author_id = $2",
        [publicSeedling, bob.id],
      )) as { n: number },
    ).toEqual({ n: 0 });
  });

  it("lets the current holder capture onto the seedling", async () => {
    const ok = await alice.client.rpc("capture_observation", {
      p_seedling_id: handover,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    expect(ok.error).toBeNull();
    expect(ok.data?.seedling_id).toBe(handover);
  });

  it("keeps read access for an originator who is no longer holder, but refuses Capture onto it", async () => {
    await simulateHolderChange(handover, bob.id);

    const read = await alice.client.from("seedlings").select("id").eq("id", handover);
    expect(read.data).toHaveLength(1);

    const attempt = await alice.client.rpc("capture_observation", {
      p_seedling_id: handover,
      p_new_seedling: false,
      p_paths: [await uploadAs(alice)],
    });
    expect(attempt.error?.message).toBe("seedling not found");
  });

  it("lets the new holder capture, and refuses the former originator any move or edit of that observation", async () => {
    const captured = await bob.client.rpc("capture_observation", {
      p_seedling_id: handover,
      p_new_seedling: false,
      p_paths: [await uploadAs(bob)],
    });
    expect(captured.error).toBeNull();
    holderObservation = captured.data!.id;

    const move = await alice.client.rpc("move_observation", {
      p_observation_id: holderObservation,
      p_target_seedling_id: publicSeedling,
    });
    expect(move.error?.message).toBe("observation not found");

    const edit = await alice.client
      .from("observations")
      .update({ note: "rewritten by the former originator" })
      .eq("id", holderObservation)
      .select("id");
    expect(refused(edit)).toBe(true);

    const view = await alice.client.from("observations").select("id").eq("id", holderObservation);
    expect(refused(view)).toBe(true);
  });

  it("refuses a suspended current holder any Capture onto their seedling", async () => {
    const path = await uploadAs(bob);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [bob.id]),
    );
    const attempt = await bob.client.rpc("capture_observation", {
      p_seedling_id: handover,
      p_new_seedling: false,
      p_paths: [path],
    });
    expect(errorCode(attempt.error)).toBe("42501");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
    );
  });
});

describe("soft-deleted media boundary", () => {
  it("stops the owner's app and storage access to a deleted observation's media, and keeps the object", async () => {
    const path = await uploadAs(alice);
    const captured = await alice.client.rpc("capture_observation", {
      p_seedling_id: publicSeedling,
      p_new_seedling: false,
      p_paths: [path],
    });
    const id = captured.data!.id;
    const { media_id: mediaId } = (await scalar(
      "select media_id from public.observation_media where observation_id = $1",
      [id],
    )) as { media_id: string };

    // Before deletion, the owner can reach the original through the signed-URL path.
    const before = await alice.client.storage.from("private-media").createSignedUrl(path, 60);
    expect(before.data?.signedUrl).toBeTruthy();
    expect((await alice.client.from("media").select("id").eq("id", mediaId)).data).toHaveLength(1);

    expect(
      (await alice.client.rpc("delete_observation", { p_observation_id: id })).error,
    ).toBeNull();

    // The media row is hidden from the owner, so /media/<id> finds nothing and returns 404.
    expect((await alice.client.from("media").select("id").eq("id", mediaId)).data).toEqual([]);

    // The owner's storage read is refused once the media is deleted: the owner-folder rule only
    // covers an object with a live media row, or with no media row at all.
    const ownerSigned = await alice.client.storage.from("private-media").createSignedUrl(path, 60);
    expect(ownerSigned.error).not.toBeNull();
    expect(ownerSigned.data).toBeNull();
    const ownerDownload = await alice.client.storage.from("private-media").download(path);
    expect(ownerDownload.error).not.toBeNull();

    // The owner cannot remove the deleted original through storage either: only the database retires media.
    await alice.client.storage.from("private-media").remove([path]);

    // Other people are refused as well.
    const visitorSigned = await visitor.storage.from("private-media").createSignedUrl(path, 60);
    expect(visitorSigned.error).not.toBeNull();
    const bobSigned = await bob.client.storage.from("private-media").createSignedUrl(path, 60);
    expect(bobSigned.error).not.toBeNull();
    expect((await bob.client.from("media").select("id").eq("id", mediaId)).data).toEqual([]);

    // The object is still physically present: no purge runs in Phase 3.
    const object = (await scalar(
      "select count(*)::int as n from storage.objects where bucket_id = 'private-media' and name = $1",
      [path],
    )) as { n: number };
    expect(object.n).toBe(1);
  });
});
