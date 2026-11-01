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
 * Seedling core authorization, tested against real requests and real rows.
 * A denied request is the security boundary. Errors use PostgREST / Postgres codes:
 * 42501 = insufficient privilege, 23505 = unique violation, 23514 = check violation,
 * P0002 = not found (also used where "not yours" must look like "does not exist").
 */

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let carol: TestUser; // admin
let dana: TestUser; // suspended later

let aliceSeries: string;
let aliceSeedling: string;
let alicePublicSeedling: string;
let aliceSecondSeedling: string;
let bobSeedling: string;

async function row(table: string, where: string, params: unknown[]) {
  return withSuperuser(async (db) => {
    const result = await db.query(`select * from public.${table} where ${where}`, params);
    return result.rows[0];
  });
}

async function holderOf(id: string) {
  return (await row("seedlings", "id = $1", [id]))?.current_holder_id as string | undefined;
}

beforeAll(async () => {
  alice = await createTestUser("seed-alice");
  bob = await createTestUser("seed-bob");
  carol = await createTestUser("seed-admin");
  dana = await createTestUser("seed-dana");
  created.push(alice.id, bob.id, carol.id, dana.id);

  await withSuperuser((db) =>
    db.query("insert into public.admin_users (user_id) values ($1)", [carol.id]),
  );
  for (const user of [alice, bob, carol, dana]) {
    const { error } = await user.client
      .from("profiles")
      .insert({ id: user.id, display_name: `Grower ${user.id.slice(0, 4)}`, country_code: "NL" });
    expect(error).toBeNull();
  }
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("creating seedlings through the domain operation", () => {
  it("creates a private seedling whose originator and holder are the caller", async () => {
    const { data, error } = await alice.client.rpc("create_seedling", {
      p_working_name: "Velvet Dusk",
      p_first_grown_year: 2024,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      originator_id: alice.id,
      current_holder_id: alice.id,
      visibility: "private",
      working_name: "Velvet Dusk",
      first_grown_year: 2024,
    });
    aliceSeedling = data!.id;
  });

  it("gives the first seedling automatic number 1 and makes it the primary identifier", async () => {
    const { data } = await alice.client
      .from("seedling_identifiers")
      .select("identifier, kind, is_primary_for_user")
      .eq("seedling_id", aliceSeedling);
    expect(data).toEqual([{ identifier: "1", kind: "automatic", is_primary_for_user: true }]);
  });

  it("records the originated provenance event with the caller as first holder", async () => {
    const { data } = await alice.client
      .from("provenance_events")
      .select("event_type, from_holder_id, to_holder_id")
      .eq("seedling_id", aliceSeedling);
    expect(data).toEqual([
      { event_type: "originated", from_holder_id: null, to_holder_id: alice.id },
    ]);
  });

  it("creates a Series seedling with a generated identifier, and the Series becomes primary", async () => {
    const series = await alice.client.rpc("create_series", { p_name: "jv", p_include_year: true });
    expect(series.error).toBeNull();
    expect(series.data).toMatchObject({ name: "JV", pattern: "JV-{YY}-{NNN}", next_sequence: 1 });
    aliceSeries = series.data!.id;

    // {YY} comes from the first-grown year, so the year is supplied with the seedling.
    const created = await alice.client.rpc("create_seedling", {
      p_series_id: aliceSeries,
      p_first_grown_year: 2026,
    });
    expect(created.error).toBeNull();
    aliceSecondSeedling = created.data!.id;

    const { data } = await alice.client
      .from("seedling_identifiers")
      .select("identifier, kind, is_primary_for_user")
      .eq("seedling_id", aliceSecondSeedling);
    const series_ = data?.find((identifier) => identifier.kind === "series");
    expect(series_?.identifier).toBe("JV-26-001");
    expect(series_?.is_primary_for_user).toBe(true);
    expect(data?.find((identifier) => identifier.kind === "automatic")?.is_primary_for_user).toBe(
      false,
    );
  });

  it("gives a second seedling in the same Series the next sequence number", async () => {
    const created = await alice.client.rpc("create_seedling", {
      p_series_id: aliceSeries,
      p_first_grown_year: 2026,
    });
    expect(created.error).toBeNull();
    const { data } = await alice.client
      .from("seedling_identifiers")
      .select("identifier")
      .eq("seedling_id", created.data!.id)
      .eq("kind", "series");
    expect(data?.[0]?.identifier).toBe("JV-26-002");
    // Year-based Series keep their sequence per cohort year, not on the Series row.
    const series = await row("series", "id = $1", [aliceSeries]);
    expect(series?.next_sequence).toBe(1);
  });

  it("numbers automatic identifiers per grower, so another grower starts at 1 too", async () => {
    const created = await bob.client.rpc("create_seedling", {});
    expect(created.error).toBeNull();
    bobSeedling = created.data!.id;
    const { data } = await bob.client
      .from("seedling_identifiers")
      .select("identifier")
      .eq("seedling_id", bobSeedling);
    expect(data).toEqual([{ identifier: "1" }]);
  });

  it("refuses a Series that belongs to another grower", async () => {
    const bobSeries = await bob.client.rpc("create_series", {
      p_name: "VT",
      p_include_year: false,
    });
    expect(bobSeries.data?.pattern).toBe("VT-{NNN}");
    const { error } = await alice.client.rpc("create_seedling", {
      p_series_id: bobSeries.data!.id,
    });
    expect(errorCode(error)).toBe("42501");
    expect(
      await row(
        "seedlings",
        "originator_id = $1 and current_holder_id = $1 and working_name is null and id not in (select seedling_id from public.seedling_identifiers where series_id = $2)",
        [alice.id, bobSeries.data!.id],
      ),
    ).toBeDefined();
  });

  it("refuses creation by a visitor", async () => {
    const { error } = await visitor.rpc("create_seedling", {});
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses a client insert that names another user as originator", async () => {
    const { error } = await bob.client
      .from("seedlings")
      .insert({ originator_id: alice.id, current_holder_id: bob.id });
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses a direct insert of identifiers, provenance or parentage", async () => {
    const identifier = await alice.client.from("seedling_identifiers").insert({
      seedling_id: aliceSeedling,
      identifier: "999",
      kind: "automatic",
      assigned_by: alice.id,
    });
    expect(errorCode(identifier.error)).toBe("42501");

    const provenance = await alice.client
      .from("provenance_events")
      .insert({ seedling_id: aliceSeedling, event_type: "originated", to_holder_id: alice.id });
    expect(errorCode(provenance.error)).toBe("42501");

    const parentage = await alice.client.from("seedling_parentage").insert({
      child_seedling_id: aliceSeedling,
      role: "seed_parent",
      is_unknown: true,
      created_by: alice.id,
    });
    expect(errorCode(parentage.error)).toBe("42501");
  });
});

describe("visibility", () => {
  it("does not let a visitor read a private seedling", async () => {
    const { data } = await visitor.from("seedlings").select("id").eq("id", aliceSeedling);
    expect(data).toEqual([]);
  });

  it("does not let another grower read a private seedling", async () => {
    const { data } = await bob.client.from("seedlings").select("id").eq("id", aliceSeedling);
    expect(data).toEqual([]);
  });

  it("lets the owner read their own private seedling", async () => {
    const { data } = await alice.client
      .from("seedlings")
      .select("id, working_name")
      .eq("id", aliceSeedling);
    expect(data).toEqual([{ id: aliceSeedling, working_name: "Velvet Dusk" }]);
  });

  it("does not expose identifiers or provenance of a private seedling", async () => {
    const identifiers = await visitor
      .from("seedling_identifiers")
      .select("id")
      .eq("seedling_id", aliceSeedling);
    const provenance = await bob.client
      .from("provenance_events")
      .select("id")
      .eq("seedling_id", aliceSeedling);
    expect(identifiers.data).toEqual([]);
    expect(provenance.data).toEqual([]);
  });

  it("lets an owner make a seedling public deliberately", async () => {
    const created = await alice.client.rpc("create_seedling", { p_working_name: "Public Example" });
    alicePublicSeedling = created.data!.id;
    const { data, error } = await alice.client
      .from("seedlings")
      .update({ visibility: "public" })
      .eq("id", alicePublicSeedling)
      .select("visibility");
    expect(error).toBeNull();
    expect(data).toEqual([{ visibility: "public" }]);
  });

  it("lets a visitor read an eligible public seedling, its identifier and its provenance", async () => {
    const seedling = await visitor
      .from("seedlings")
      .select("working_name")
      .eq("id", alicePublicSeedling);
    expect(seedling.data).toEqual([{ working_name: "Public Example" }]);
    const identifiers = await visitor
      .from("seedling_identifiers")
      .select("identifier")
      .eq("seedling_id", alicePublicSeedling);
    expect(identifiers.data).toHaveLength(1);
    const provenance = await visitor
      .from("provenance_events")
      .select("event_type")
      .eq("seedling_id", alicePublicSeedling);
    expect(provenance.data).toEqual([{ event_type: "originated" }]);
  });

  it("lets another authenticated grower read the public seedling", async () => {
    const { data } = await bob.client.from("seedlings").select("id").eq("id", alicePublicSeedling);
    expect(data).toEqual([{ id: alicePublicSeedling }]);
  });

  it("hides a public seedling whose current holder is suspended", async () => {
    const created = await dana.client.rpc("create_seedling", { p_visibility: "public" });
    expect(created.error).toBeNull();
    const danaSeedling = created.data!.id;
    const before = await visitor.from("seedlings").select("id").eq("id", danaSeedling);
    expect(before.data).toHaveLength(1);

    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [dana.id]),
    );
    const after = await visitor.from("seedlings").select("id").eq("id", danaSeedling);
    expect(after.data).toEqual([]);
    // The suspended owner can still read their own seedling.
    const own = await dana.client.from("seedlings").select("id").eq("id", danaSeedling);
    expect(own.data).toEqual([{ id: danaSeedling }]);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [dana.id]),
    );
  });
});

describe("editing and protected identity", () => {
  it("does not let another grower change someone else's seedling", async () => {
    const { data, error } = await bob.client
      .from("seedlings")
      .update({ working_name: "Hijacked" })
      .eq("id", aliceSeedling)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await row("seedlings", "id = $1", [aliceSeedling]))?.working_name).toBe("Velvet Dusk");
  });

  it("lets the holder edit the working name, year and visibility", async () => {
    const { data, error } = await alice.client
      .from("seedlings")
      .update({ working_name: "Velvet Dusk II", first_grown_year: 2025 })
      .eq("id", aliceSeedling)
      .select("working_name, first_grown_year");
    expect(error).toBeNull();
    expect(data).toEqual([{ working_name: "Velvet Dusk II", first_grown_year: 2025 }]);
  });

  it("refuses a holder rewriting the originator", async () => {
    const { error } = await alice.client
      .from("seedlings")
      .update({ originator_id: bob.id })
      .eq("id", aliceSeedling);
    expect(errorCode(error)).toBe("42501");
  });

  it("refuses a holder rewriting the current holder", async () => {
    const { error } = await alice.client
      .from("seedlings")
      .update({ current_holder_id: bob.id })
      .eq("id", aliceSeedling);
    expect(errorCode(error)).toBe("42501");
    expect(await holderOf(aliceSeedling)).toBe(alice.id);
  });

  it("refuses even a privileged holder rewrite that does not come from the continuation transaction", async () => {
    await expect(
      withSuperuser((db) =>
        db.query("update public.seedlings set current_holder_id = $2 where id = $1", [
          aliceSeedling,
          bob.id,
        ]),
      ),
    ).rejects.toThrow(/confirmed continuation/);
    expect(await holderOf(aliceSeedling)).toBe(alice.id);
  });

  it("refuses rewriting the originator even from the privileged role", async () => {
    await expect(
      withSuperuser((db) =>
        db.query("update public.seedlings set originator_id = $2 where id = $1", [
          aliceSeedling,
          bob.id,
        ]),
      ),
    ).rejects.toThrow(/originator attribution is permanent/);
  });

  it("refuses to hard-delete a seedling", async () => {
    await expect(
      withSuperuser((db) =>
        db.query("delete from public.seedlings where id = $1", [aliceSeedling]),
      ),
    ).rejects.toThrow(/never hard-deleted/);
  });

  it("refuses an invalid working name at the database", async () => {
    const { error } = await alice.client
      .from("seedlings")
      .update({ working_name: "x".repeat(81) })
      .eq("id", aliceSeedling);
    expect(errorCode(error)).toBe("23514");
  });

  it("lets a suspended owner read but not edit their seedling", async () => {
    const created = await dana.client.rpc("create_seedling", {});
    const danaPrivate = created.data!.id;
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [dana.id]),
    );

    const read = await dana.client.from("seedlings").select("id").eq("id", danaPrivate);
    expect(read.data).toEqual([{ id: danaPrivate }]);
    const edit = await dana.client
      .from("seedlings")
      .update({ working_name: "Blocked" })
      .eq("id", danaPrivate)
      .select("id");
    expect(edit.data).toEqual([]);
    const create = await dana.client.rpc("create_seedling", {});
    expect(errorCode(create.error)).toBe("42501");

    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [dana.id]),
    );
  });
});

describe("identifiers", () => {
  it("refuses a duplicate identifier in the same grower namespace", async () => {
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.seedling_identifiers (seedling_id, identifier, kind, assigned_by) values ($1, '1', 'automatic', $2)",
          [bobSeedling, alice.id],
        ),
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("refuses changing an identifier value or its owner", async () => {
    const identifierRow = await row(
      "seedling_identifiers",
      "seedling_id = $1 and kind = 'automatic'",
      [aliceSeedling],
    );
    await expect(
      withSuperuser((db) =>
        db.query("update public.seedling_identifiers set identifier = '777' where id = $1", [
          identifierRow!.id,
        ]),
      ),
    ).rejects.toThrow(/never change/);
  });

  it("refuses deleting an identifier, so a number is never reused", async () => {
    const identifierRow = await row(
      "seedling_identifiers",
      "seedling_id = $1 and kind = 'automatic'",
      [aliceSeedling],
    );
    await expect(
      withSuperuser((db) =>
        db.query("delete from public.seedling_identifiers where id = $1", [identifierRow!.id]),
      ),
    ).rejects.toThrow(/never deleted/);
  });

  it("resolves a retired alias to its canonical seedling and still never reissues it", async () => {
    const created = await alice.client.rpc("create_seedling", {});
    const duplicate = created.data!.id;
    const duplicateNumber = await row("seedling_identifiers", "seedling_id = $1", [duplicate]);
    await withSuperuser((db) =>
      db.query(
        "update public.seedling_identifiers set is_retired_alias = true, is_primary_for_user = false where id = $1",
        [duplicateNumber!.id],
      ),
    );
    const resolved = await alice.client.rpc("resolve_own_identifier", {
      p_identifier: duplicateNumber!.identifier,
    });
    expect(resolved.data).toEqual([{ seedling_id: duplicate, is_retired_alias: true }]);

    // The retired number is still in the namespace, so the next automatic number is higher.
    const next = await alice.client.rpc("create_seedling", {});
    const nextNumber = await alice.client
      .from("seedling_identifiers")
      .select("identifier")
      .eq("seedling_id", next.data!.id);
    expect(Number(nextNumber.data?.[0]?.identifier)).toBeGreaterThan(
      Number(duplicateNumber!.identifier),
    );
  });

  it("resolves only within the caller's namespace", async () => {
    const { data } = await bob.client.rpc("resolve_own_identifier", { p_identifier: "1" });
    expect(data?.map((item: { seedling_id: string }) => item.seedling_id)).toEqual([bobSeedling]);
  });
});

describe("Series ownership", () => {
  it("does not let another grower read or change a Series", async () => {
    const readSeries = await bob.client.from("series").select("id").eq("id", aliceSeries);
    expect(readSeries.data).toEqual([]);
    const update = await bob.client
      .from("series")
      .update({ active: false })
      .eq("id", aliceSeries)
      .select("id");
    expect(update.data).toEqual([]);
  });

  it("refuses direct changes to the Series counter", async () => {
    const { error } = await alice.client
      .from("series")
      .update({ next_sequence: 1 })
      .eq("id", aliceSeries);
    expect(errorCode(error)).toBe("42501");
  });

  it("validates series names and rejects duplicates for one grower", async () => {
    const bad = await alice.client.rpc("create_series", { p_name: "J V", p_include_year: true });
    expect(errorCode(bad.error)).toBe("23514");
    const duplicate = await alice.client.rpc("create_series", {
      p_name: "JV",
      p_include_year: true,
    });
    expect(errorCode(duplicate.error)).toBe("23505");
  });
});

describe("parentage", () => {
  it("records an unknown seed parent without inventing a parent", async () => {
    const { error } = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: aliceSecondSeedling,
      p_role: "seed_parent",
      p_kind: "unknown",
    });
    expect(error).toBeNull();
    const { data } = await alice.client
      .from("seedling_parentage")
      .select("role, is_unknown")
      .eq("child_seedling_id", aliceSecondSeedling);
    expect(data).toEqual([{ role: "seed_parent", is_unknown: true }]);
  });

  it("records a cultivar parent through a lightweight reference, shown with the seedling it belongs to", async () => {
    const { error } = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: aliceSecondSeedling,
      p_role: "seed_parent",
      p_kind: "cultivar",
      p_cultivar_name: "  Wizard   of Oz ",
    });
    expect(error).toBeNull();
    const holderView = await alice.client
      .from("seedling_parentage")
      .select("cultivar_references(name)")
      .eq("child_seedling_id", aliceSecondSeedling);
    expect(holderView.data).toEqual([{ cultivar_references: { name: "Wizard of Oz" } }]);
    // The child is still private, so a visitor sees nothing about it.
    const visitorView = await visitor
      .from("seedling_parentage")
      .select("id")
      .eq("child_seedling_id", aliceSecondSeedling);
    expect(visitorView.data).toEqual([]);
  });

  it("does not show a private parent to a visitor, even on a public child", async () => {
    // Child: a public seedling. Parent: the private aliceSeedling.
    const set = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: alicePublicSeedling,
      p_role: "pollen_parent",
      p_kind: "seedling",
      p_parent_seedling_id: aliceSeedling,
    });
    expect(set.error).toBeNull();

    const visitorView = await visitor
      .from("seedling_parentage")
      .select("id")
      .eq("child_seedling_id", alicePublicSeedling);
    expect(visitorView.data).toEqual([]);
    const ownerView = await alice.client
      .from("seedling_parentage")
      .select("id")
      .eq("child_seedling_id", alicePublicSeedling);
    expect(ownerView.data).toHaveLength(1);
  });

  it("does not let a grower attach a parent they cannot see", async () => {
    const { error } = await bob.client.rpc("set_seedling_parent", {
      p_seedling_id: bobSeedling,
      p_role: "seed_parent",
      p_kind: "seedling",
      p_parent_seedling_id: aliceSeedling,
    });
    expect(errorCode(error)).toBe("P0002");
  });

  it("does not let another grower change parentage on a seedling they do not hold", async () => {
    const { error } = await bob.client.rpc("set_seedling_parent", {
      p_seedling_id: aliceSecondSeedling,
      p_role: "pollen_parent",
      p_kind: "unknown",
    });
    expect(errorCode(error)).toBe("P0002");
  });

  it("refuses a seedling as its own parent", async () => {
    const { error } = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: aliceSecondSeedling,
      p_role: "pollen_parent",
      p_kind: "seedling",
      p_parent_seedling_id: aliceSecondSeedling,
    });
    expect(errorCode(error)).toBe("P0002");
  });

  it("refuses a parent row that names both a seedling and an unknown", async () => {
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.seedling_parentage (child_seedling_id, role, parent_seedling_id, is_unknown, created_by) values ($1, 'pollen_parent', $2, true, $3)",
          [aliceSecondSeedling, aliceSeedling, alice.id],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("keeps parentage out of reach of ordinary writes", async () => {
    const { error } = await alice.client
      .from("seedling_parentage")
      .delete()
      .eq("child_seedling_id", aliceSecondSeedling);
    expect(errorCode(error)).toBe("42501");
  });
});

describe("cultivar references and provenance", () => {
  it("lets visitors read cultivar references but not create them directly", async () => {
    const read = await visitor.from("cultivar_references").select("name");
    expect(read.error).toBeNull();
    const write = await alice.client
      .from("cultivar_references")
      .insert({ name: "Direct", normalized_name: "direct" });
    expect(errorCode(write.error)).toBe("42501");
  });

  it("makes provenance append-only, even for a privileged role", async () => {
    const event = await row("provenance_events", "seedling_id = $1", [alicePublicSeedling]);
    await expect(
      withSuperuser((db) =>
        db.query("update public.provenance_events set event_type = 'originated' where id = $1", [
          event!.id,
        ]),
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      withSuperuser((db) =>
        db.query("delete from public.provenance_events where id = $1", [event!.id]),
      ),
    ).rejects.toThrow(/append-only/);
    const ordinary = await alice.client
      .from("provenance_events")
      .update({ occurred_at: new Date(0).toISOString() })
      .eq("id", event!.id);
    expect(errorCode(ordinary.error)).toBe("42501");
  });
});
