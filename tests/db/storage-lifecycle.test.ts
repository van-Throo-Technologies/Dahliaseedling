import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Phase 10B media lifecycle. A stored object is referenced only by a live row. Detection is read-only and administrator-only. Erasure queues
 * objects for purge and removes none of them, and nothing in this phase deletes an object.
 */

const tag = "st" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser;
let admin: TestUser;
let livePath = "";
let livePublicPath = "";
let retiredPath = "";
let orphanPath = "";
let avatarPath = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function referenced(bucket: string, name: string): Promise<boolean> {
  const [row] = await rows("select public._storage_object_referenced($1, $2) as r", [bucket, name]);
  return row.r as boolean;
}

beforeAll(async () => {
  alice = await createTestUser("st-alice");
  admin = await createTestUser("st-admin");
  created.push(alice.id, admin.id);
  await withSuperuser(async (db) => {
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [alice.id, `Alice ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [admin.id, `Admin ${tag}`],
    );
    await db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]);
  });

  const seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Storage ${tag}`,
      p_visibility: "public",
    })
  ).data!.id as string;
  const photo = await capturePhoto(alice, seedling);
  const published = await publishPublicImage(alice, photo);
  const media = await rows(
    "select storage_path, public_derivative_path from public.media where id = $1",
    [photo.mediaId],
  );
  livePath = media[0].storage_path as string;
  livePublicPath = published.derivativePath;

  // A second capture whose media is soft-deleted: its object is no longer referenced by a live row.
  const second = await capturePhoto(alice, seedling);
  retiredPath = (
    await rows("select storage_path from public.media where id = $1", [second.mediaId])
  )[0].storage_path as string;
  await withSuperuser((db) =>
    db.query("update public.media set deleted_at = now() where id = $1", [second.mediaId]),
  );

  orphanPath = `${alice.id}/orphan-${tag}.jpg`;
  avatarPath = `${alice.id}/avatar-${tag}.webp`;
  await withSuperuser(async (db) => {
    await db.query(
      "insert into storage.objects (bucket_id, name, owner) values ('private-media', $1, $2)",
      [orphanPath, alice.id],
    );
    await db.query(
      "insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)",
      [avatarPath, alice.id],
    );
    await db.query("update public.profiles set avatar_path = $1 where id = $2", [
      avatarPath,
      alice.id,
    ]);
  });
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("a stored object is referenced only by a live row", () => {
  it("a live original is referenced, and a soft-deleted original is not", async () => {
    expect(await referenced("private-media", livePath)).toBe(true);
    expect(await referenced("private-media", retiredPath)).toBe(false);
  });

  it("a live public derivative is referenced, and an unknown object is not", async () => {
    expect(await referenced("public-media", livePublicPath)).toBe(true);
    expect(await referenced("public-media", `${alice.id}/unknown.webp`)).toBe(false);
  });

  it("a current avatar is referenced", async () => {
    expect(await referenced("avatars", avatarPath)).toBe(true);
  });
});

describe("orphan detection is administrator-only and read-only", () => {
  it("a grower sees no orphan candidates", async () => {
    const { data, error } = await alice.client.rpc("storage_orphan_candidates", { p_limit: 500 });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an administrator sees the orphan and the soft-deleted original, but never a referenced object", async () => {
    const { data, error } = await admin.client.rpc("storage_orphan_candidates", { p_limit: 1000 });
    expect(error).toBeNull();
    const names = (data as Array<{ object_name: string }>).map((r) => r.object_name);
    expect(names).toContain(orphanPath);
    expect(names).toContain(retiredPath);
    expect(names).not.toContain(livePath);
    expect(names).not.toContain(avatarPath);
  });

  it("detection changes no object", async () => {
    const [n] = await rows(
      "select count(*)::int as n from storage.objects where bucket_id = 'private-media' and name in ($1, $2)",
      [orphanPath, retiredPath],
    );
    expect(n.n).toBe(2);
  });
});

describe("the purge queue is append-only and invisible to growers", () => {
  it("a queued object appears to an administrator only while nothing live references it", async () => {
    await withSuperuser((db) =>
      db.query(
        "insert into public.storage_purge_queue (bucket, object_path, owner_id, reason) values ('private-media', $1, $2, 'observation_erased')",
        [retiredPath, alice.id],
      ),
    );
    await withSuperuser((db) =>
      db.query(
        "insert into public.storage_purge_queue (bucket, object_path, owner_id, reason) values ('private-media', $1, $2, 'observation_erased')",
        [livePath, alice.id],
      ),
    );
    const { data, error } = await admin.client.rpc("storage_purge_eligible", { p_limit: 1000 });
    expect(error).toBeNull();
    const paths = (data as Array<{ object_path: string }>).map((r) => r.object_path);
    expect(paths).toContain(retiredPath);
    expect(paths).not.toContain(livePath);
  });

  it("a grower cannot read the queue, and a grower cannot list purge candidates", async () => {
    expect((await alice.client.from("storage_purge_queue").select("id")).data ?? []).toEqual([]);
    const { data } = await alice.client.rpc("storage_purge_eligible", { p_limit: 100 });
    expect(data).toEqual([]);
  });

  it("the same object is queued once", async () => {
    const duplicate = await withSuperuser((db) =>
      db
        .query(
          "insert into public.storage_purge_queue (bucket, object_path, owner_id, reason) values ('private-media', $1, $2, 'observation_erased')",
          [retiredPath, alice.id],
        )
        .then(() => null)
        .catch((error: { code?: string }) => error.code ?? "unknown"),
    );
    expect(duplicate).toBe("23505");
  });

  it("no client can insert into the queue", async () => {
    const { error } = await alice.client.from("storage_purge_queue").insert({
      bucket: "private-media",
      object_path: `${alice.id}/forged.jpg`,
      owner_id: alice.id,
      reason: "observation_erased",
    } as never);
    expect(errorCode(error)).toBe("42501");
  });
});

describe("erasure removes no stored object", () => {
  it("a grower's erasure queues their media for purge and leaves every object in storage", async () => {
    const grower = await createTestUser("st-erased");
    created.push(grower.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
        [grower.id, `Erased ${tag}`],
      ),
    );
    const seedling = (
      await grower.client.rpc("create_seedling", {
        p_working_name: `Erase ${tag}`,
        p_visibility: "private",
      })
    ).data!.id as string;
    const photo = await capturePhoto(grower, seedling);
    const before = await rows("select count(*)::int as n from storage.objects where owner = $1", [
      grower.id,
    ]);
    expect(before[0].n).toBeGreaterThan(0);

    expect((await grower.client.rpc("deactivate_my_account")).error).toBeNull();
    expect((await grower.client.rpc("request_my_erasure")).error).toBeNull();

    const after = await rows("select count(*)::int as n from storage.objects where owner = $1", [
      grower.id,
    ]);
    expect(after[0].n).toBe(before[0].n);
    const queued = await rows(
      "select count(*)::int as n from public.storage_purge_queue where owner_id = $1 and state = 'awaiting_authorization'",
      [grower.id],
    );
    expect(queued[0].n).toBeGreaterThan(0);
    const [media] = await rows("select deleted_at from public.media where id = $1", [
      photo.mediaId,
    ]);
    expect(media.deleted_at).not.toBeNull();
  });
});
