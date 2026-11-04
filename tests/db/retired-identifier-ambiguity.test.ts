import { afterAll, beforeAll, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Identifiers are unique per grower, so two growers can each hold a retired alias with the same text. The resolver must not pick one
 * of them: with more than one canonical Seedling in play it returns nothing.
 */

const tag = "am" + Math.random().toString(36).slice(2, 8);
const shared = "AMB-" + tag;
const created: string[] = [];
let alice: TestUser;
let bob: TestUser;

async function retiredPair(user: TestUser, name: string) {
  const keep = (
    await user.client.rpc("create_seedling", {
      p_working_name: `${name} keep`,
      p_visibility: "public",
    })
  ).data!.id as string;
  const dup = (
    await user.client.rpc("create_seedling", {
      p_working_name: `${name} dup`,
      p_visibility: "public",
    })
  ).data!.id as string;
  expect(
    (
      await user.client.rpc("merge_seedlings", {
        p_canonical: keep,
        p_duplicate: dup,
        p_confirmed: true,
      })
    ).error,
  ).toBeNull();
  await withSuperuser((db) =>
    db.query(
      `insert into public.seedling_identifiers (seedling_id, identifier, kind, assigned_by, is_retired_alias)
       values ($1, $2, 'local', $3, true)`,
      [dup, shared, user.id],
    ),
  );
  return keep;
}

beforeAll(async () => {
  alice = await createTestUser("am-alice");
  bob = await createTestUser("am-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });
  await retiredPair(alice, "A");
  await retiredPair(bob, "B");
});

afterAll(async () => {
  await removeTestUsers(created);
});

it("two growers' retired aliases with the same text resolve to nothing, never to an arbitrary one", async () => {
  expect(
    (await anonClient().rpc("resolve_retired_identifier", { p_query: shared })).data,
  ).toBeNull();
});
