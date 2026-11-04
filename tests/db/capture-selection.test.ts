import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto } from "../support/public-update";

/*
 * Manual-first Capture selection (Phase 9). The candidate corpus is exactly the Seedlings the signed-in grower currently holds and
 * that are active. Ordering is deterministic. Nothing else is offered: another grower's Seedlings, a Seedling the grower originated
 * but no longer holds, and a retired merged identity never appear.
 */

const tag = "cs" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser;
let bob: TestUser;
let recentCapture = "";
let noCapture = "";
let retiredOne = "";
let retiredTwo = "";
let bobPrivate = "";
let bobPublic = "";
let transferredAway = "";

async function seedling(user: TestUser, name: string, visibility: "public" | "private") {
  const { data, error } = await user.client.rpc("create_seedling", {
    p_working_name: `${name} ${tag}`,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

beforeAll(async () => {
  alice = await createTestUser("cs-alice");
  bob = await createTestUser("cs-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });

  recentCapture = await seedling(alice, "Recent", "private");
  await capturePhoto(alice, recentCapture);
  noCapture = await seedling(alice, "Quiet", "private");
  retiredOne = await seedling(alice, "Retired one", "private");
  retiredTwo = await seedling(alice, "Retired two", "private");
  expect(
    (
      await alice.client.rpc("merge_seedlings", {
        p_canonical: noCapture,
        p_duplicate: retiredOne,
        p_confirmed: true,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await alice.client.rpc("merge_seedlings", {
        p_canonical: noCapture,
        p_duplicate: retiredTwo,
        p_confirmed: true,
      })
    ).error,
  ).toBeNull();
  bobPrivate = await seedling(bob, "Bob private", "private");
  bobPublic = await seedling(bob, "Bob public", "public");
  // A Seedling Alice originated and then no longer holds: the holder change is a Phase 6 transaction, simulated here with its flag.
  transferredAway = await seedling(alice, "Transferred away", "private");
  await withSuperuser(async (db) => {
    await db.query("begin");
    await db.query("select set_config('dahlia.holder_transfer', 'confirmed', true)");
    await db.query("update public.seedlings set current_holder_id = $1 where id = $2", [
      bob.id,
      transferredAway,
    ]);
    await db.query("commit");
  });
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the candidate corpus", () => {
  it("offers exactly the caller's active Seedlings held as current holder", async () => {
    const { data, error } = await alice.client.rpc("held_seedling_candidates", { p_limit: 200 });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { seedling_id: string }) => r.seedling_id);
    expect(ids).toContain(recentCapture);
    expect(ids).toContain(noCapture);
    expect(ids).not.toContain(bobPrivate);
    expect(ids).not.toContain(bobPublic);
    expect(ids).not.toContain(transferredAway);
    expect(ids).not.toContain(retiredOne);
    expect(ids).not.toContain(retiredTwo);
  });

  it("another grower's public Seedling is never offered to Alice, even though it is visible to her", async () => {
    const { data } = await alice.client.rpc("held_seedling_candidates", { p_limit: 200 });
    expect((data ?? []).map((r: { seedling_id: string }) => r.seedling_id)).not.toContain(
      bobPublic,
    );
  });

  it("orders the most recent capture first, then creation time, then identifier, and the order is stable", async () => {
    const first = await alice.client.rpc("held_seedling_candidates", { p_limit: 200 });
    const second = await alice.client.rpc("held_seedling_candidates", { p_limit: 200 });
    const order = (first.data ?? []).map((r: { seedling_id: string }) => r.seedling_id);
    expect(order).toEqual((second.data ?? []).map((r: { seedling_id: string }) => r.seedling_id));
    expect(order.indexOf(recentCapture)).toBeLessThan(order.indexOf(noCapture));
  });

  it("the function is invoker-scoped: a visitor receives nothing", async () => {
    const { anonClient } = await import("../support/local-supabase");
    const anon = anonClient();
    const { data, error } = await anon.rpc("held_seedling_candidates", { p_limit: 200 });
    expect(error).not.toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("the function cannot be used to read another grower's Seedlings even with a specified limit", async () => {
    const { data } = await bob.client.rpc("held_seedling_candidates", { p_limit: 200 });
    const ids = (data ?? []).map((r: { seedling_id: string }) => r.seedling_id);
    expect(ids).toContain(bobPrivate);
    expect(ids).not.toContain(recentCapture);
  });
});
