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
 * Originator read access, holder authority, parent visibility and suspension. Continuation does not
 * exist yet, so a future holder change is simulated with the test-only helper, which uses the same
 * transaction flag the continuation transaction will use.
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser; // originator
let bob: TestUser; // will become the holder
let carol: TestUser; // another grower
let dana: TestUser; // will be suspended

let privateSeedling: string;
let publicSeedling: string;
let carolPrivate: string;

beforeAll(async () => {
  alice = await createTestUser("access-alice");
  bob = await createTestUser("access-bob");
  carol = await createTestUser("access-carol");
  dana = await createTestUser("access-dana");
  created.push(alice.id, bob.id, carol.id, dana.id);
  for (const user of [alice, bob, carol, dana]) {
    const profile = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: `Access ${user.id.slice(0, 4)}`, country_code: "FR" });
    expect(profile.error).toBeNull();
  }

  const made = await alice.client.rpc("create_seedling", { p_working_name: "Private Origin" });
  privateSeedling = made.data!.id;
  const made2 = await alice.client.rpc("create_seedling", {
    p_working_name: "Public Origin",
    p_visibility: "public",
  });
  publicSeedling = made2.data!.id;
  const made3 = await carol.client.rpc("create_seedling", { p_working_name: "Carol Private" });
  carolPrivate = made3.data!.id;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("originator read access and holder authority", () => {
  it("keeps read access to a private seedling for its originator before any holder change", async () => {
    const { data } = await alice.client.from("seedlings").select("id").eq("id", privateSeedling);
    expect(data).toEqual([{ id: privateSeedling }]);
  });

  it("simulates a future holder change, moving the seedling to bob", async () => {
    await simulateHolderChange(privateSeedling, bob.id);
    const row = await withSuperuser((db) =>
      db.query("select current_holder_id, originator_id from public.seedlings where id = $1", [
        privateSeedling,
      ]),
    );
    expect(row.rows[0]).toEqual({ current_holder_id: bob.id, originator_id: alice.id });
  });

  it("keeps the originator's READ access to the private seedling after the holder changed", async () => {
    const { data, error } = await alice.client
      .from("seedlings")
      .select("id, working_name")
      .eq("id", privateSeedling);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: privateSeedling, working_name: "Private Origin" }]);
  });

  it("lets the originator read the identifiers, parentage and provenance that go with that seedling", async () => {
    const identifiers = await alice.client
      .from("seedling_identifiers")
      .select("identifier")
      .eq("seedling_id", privateSeedling);
    expect(identifiers.data).toHaveLength(1);
    const provenance = await alice.client
      .from("provenance_events")
      .select("event_type")
      .eq("seedling_id", privateSeedling);
    expect(provenance.data).toEqual([{ event_type: "originated" }]);
  });

  it("gives the originator no authority: no edit of name, year or privacy", async () => {
    const edit = await alice.client
      .from("seedlings")
      .update({ working_name: "Rewritten by originator", visibility: "public" })
      .eq("id", privateSeedling)
      .select("id");
    expect(edit.error).toBeNull();
    expect(edit.data).toEqual([]);
    const row = await withSuperuser((db) =>
      db.query("select working_name, visibility from public.seedlings where id = $1", [
        privateSeedling,
      ]),
    );
    expect(row.rows[0]).toEqual({ working_name: "Private Origin", visibility: "private" });
  });

  it("gives the originator no authority over parentage", async () => {
    const { error } = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: privateSeedling,
      p_role: "seed_parent",
      p_kind: "unknown",
    });
    expect(errorCode(error)).toBe("P0002");
  });

  it("gives the originator no authority over identifiers", async () => {
    const { error } = await alice.client.rpc("attach_series_identifier", {
      p_seedling_id: privateSeedling,
      p_series_id: "00000000-0000-4000-8000-000000000000",
    });
    expect(errorCode(error)).toBe("P0002");
  });

  it("refuses the originator changing the current holder", async () => {
    const { error } = await alice.client
      .from("seedlings")
      .update({ current_holder_id: alice.id })
      .eq("id", privateSeedling);
    expect(errorCode(error)).toBe("42501");
  });

  it("keeps management with the current holder", async () => {
    const edit = await bob.client
      .from("seedlings")
      .update({ working_name: "Held by Bob" })
      .eq("id", privateSeedling)
      .select("working_name");
    expect(edit.data).toEqual([{ working_name: "Held by Bob" }]);
  });

  it("keeps the originator's read access separate from visitor visibility", async () => {
    const { data } = await visitor.from("seedlings").select("id").eq("id", privateSeedling);
    expect(data).toEqual([]);
    const other = await carol.client.from("seedlings").select("id").eq("id", privateSeedling);
    expect(other.data).toEqual([]);
  });
});

describe("parent visibility", () => {
  it("lets a grower choose another grower's visible public seedling as a parent", async () => {
    const { error } = await bob.client.rpc("set_seedling_parent", {
      p_seedling_id: privateSeedling,
      p_role: "pollen_parent",
      p_kind: "seedling",
      p_parent_seedling_id: publicSeedling,
    });
    expect(error).toBeNull();
    const row = await bob.client
      .from("seedling_parentage")
      .select("parent_seedling_id")
      .eq("child_seedling_id", privateSeedling);
    expect(row.data).toEqual([{ parent_seedling_id: publicSeedling }]);
  });

  it("refuses another grower's private seedling as a parent", async () => {
    const { error } = await bob.client.rpc("set_seedling_parent", {
      p_seedling_id: privateSeedling,
      p_role: "seed_parent",
      p_kind: "seedling",
      p_parent_seedling_id: carolPrivate,
    });
    expect(errorCode(error)).toBe("P0002");
  });

  it("does not disclose a private parent through a public child", async () => {
    const child = await bob.client.rpc("create_seedling", {
      p_working_name: "Public child",
      p_visibility: "public",
    });
    const childId = child.data!.id;
    const set = await bob.client.rpc("set_seedling_parent", {
      p_seedling_id: childId,
      p_role: "seed_parent",
      p_kind: "seedling",
      p_parent_seedling_id: carolPrivate,
    });
    expect(errorCode(set.error)).toBe("P0002");

    // Even when the link exists (for example a parent that became private later), visitors see no row.
    await withSuperuser((db) =>
      db.query(
        "insert into public.seedling_parentage (child_seedling_id, role, parent_seedling_id, created_by) values ($1, 'seed_parent', $2, $3)",
        [childId, carolPrivate, bob.id],
      ),
    );
    const visitorView = await visitor
      .from("seedling_parentage")
      .select("id, parent_seedling_id")
      .eq("child_seedling_id", childId);
    expect(visitorView.data).toEqual([]);
    const holderView = await bob.client
      .from("seedling_parentage")
      .select("id")
      .eq("child_seedling_id", childId);
    expect(holderView.data).toEqual([]);
  });
});

describe("suspended holder", () => {
  let danaPublic: string;

  it("hides a suspended holder's public seedling from visitors and other growers", async () => {
    const made = await dana.client.rpc("create_seedling", {
      p_working_name: "Dana public",
      p_visibility: "public",
    });
    danaPublic = made.data!.id;
    expect((await visitor.from("seedlings").select("id").eq("id", danaPublic)).data).toHaveLength(
      1,
    );

    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [dana.id]),
    );
    expect((await visitor.from("seedlings").select("id").eq("id", danaPublic)).data).toEqual([]);
    expect((await carol.client.from("seedlings").select("id").eq("id", danaPublic)).data).toEqual(
      [],
    );
  });

  it("keeps the suspended holder's own read access and changes nothing in the data", async () => {
    const own = await dana.client
      .from("seedlings")
      .select("working_name, visibility")
      .eq("id", danaPublic);
    expect(own.data).toEqual([{ working_name: "Dana public", visibility: "public" }]);
  });

  it("keeps participation disabled while suspended", async () => {
    const edit = await dana.client
      .from("seedlings")
      .update({ working_name: "Blocked" })
      .eq("id", danaPublic)
      .select("id");
    expect(edit.data).toEqual([]);
    const attach = await dana.client.rpc("create_seedling", {});
    expect(errorCode(attach.error)).toBe("42501");
    const row = await withSuperuser((db) =>
      db.query("select working_name from public.seedlings where id = $1", [danaPublic]),
    );
    expect(row.rows[0]?.working_name).toBe("Dana public");
  });

  it("restores public visibility when the account is reinstated", async () => {
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [dana.id]),
    );
    expect((await visitor.from("seedlings").select("id").eq("id", danaPublic)).data).toHaveLength(
      1,
    );
  });
});
