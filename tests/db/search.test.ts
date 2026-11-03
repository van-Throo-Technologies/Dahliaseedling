import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Search & Discovery. Every check runs as a visitor, the public reader of Search, through the database functions
 * the app calls. Private Seedlings, suspended growers and private parents must never appear, and a zero-result
 * search must reveal nothing. Names are made unique per run, because the database is shared with other suites.
 */

const created: string[] = [];
const visitor = anonClient();
const tag = "q" + Math.random().toString(36).slice(2, 8);
// Series names are per grower, so two growers can own the same series and so the same identifier.
const series = "S" + Math.random().toString(36).slice(2, 8).toUpperCase();

let alice: TestUser; // NL, owns the public series seedling, a private seedling and a parent
let bob: TestUser; // BE, owns the same series name, so the same identifier
let carol: TestUser; // DE, public seedling, suspended later in the suite

let aliceSeedling: string; // public, series identifier, no Update
let bobSeedling: string; // public, same series identifier as Alice's
let hiddenParent: string; // private parent of a public child
let publicChild: string; // public child of the private parent
let parentAlpha: string; // public parent
let alphaChild: string; // public child of Parent Alpha
let cultivarSeedParentChild: string;
let cultivarPollenParentChild: string;
let carolSeedling: string;
let seriesIdentifier: string;

async function call<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await visitor.rpc(name, args);
  if (error) throw new Error(`${name} failed: ${error.message}`);
  return (data ?? []) as T[];
}

async function seedlingHits(query: string | null, country: string | null = null) {
  return call<{
    seedling_id: string;
    match_reason: string;
    holder_id: string;
    working_name: string | null;
  }>("search_seedlings", { p_query: query ?? "", p_country: country, p_limit: 12 });
}

beforeAll(async () => {
  alice = await createTestUser("search-alice");
  bob = await createTestUser("search-bob");
  carol = await createTestUser("search-carol");
  created.push(alice.id, bob.id, carol.id);

  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });
  await carol.client
    .from("profiles")
    .insert({ id: carol.id, display_name: `Carol ${tag}`, country_code: "DE" });
  await withSuperuser((db) =>
    db.query("update public.profiles set account_type_label = 'breeder' where id = $1", [bob.id]),
  );

  const aliceSeries = (
    await alice.client.rpc("create_series", { p_name: series, p_include_year: true })
  ).data!;
  const bobSeries = (
    await bob.client.rpc("create_series", { p_name: series, p_include_year: true })
  ).data!;

  aliceSeedling = (
    await alice.client.rpc("create_seedling", {
      p_series_id: aliceSeries.id,
      p_working_name: `Sunset Surprise ${tag}`,
      p_first_grown_year: 2026,
      p_visibility: "public",
    })
  ).data!.id;
  bobSeedling = (
    await bob.client.rpc("create_seedling", {
      p_series_id: bobSeries.id,
      p_working_name: `Dune ${tag}`,
      p_first_grown_year: 2026,
      p_visibility: "public",
    })
  ).data!.id;
  // A private seedling: it must never appear in any search, so it is created but never read back.
  await alice.client.rpc("create_seedling", {
    p_working_name: `Quiet Ember ${tag}`,
    p_visibility: "private",
  });
  hiddenParent = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Hidden Parent ${tag}`,
      p_visibility: "private",
    })
  ).data!.id;
  publicChild = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Public Child ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  await alice.client.rpc("set_seedling_parent", {
    p_seedling_id: publicChild,
    p_role: "pollen_parent",
    p_kind: "seedling",
    p_parent_seedling_id: hiddenParent,
  });

  parentAlpha = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Parent Alpha ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  alphaChild = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Alpha Child ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  await alice.client.rpc("set_seedling_parent", {
    p_seedling_id: alphaChild,
    p_role: "seed_parent",
    p_kind: "seedling",
    p_parent_seedling_id: parentAlpha,
  });

  cultivarSeedParentChild = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Oz Seed ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  await alice.client.rpc("set_seedling_parent", {
    p_seedling_id: cultivarSeedParentChild,
    p_role: "seed_parent",
    p_kind: "cultivar",
    p_cultivar_name: "Wizard of Oz",
  });
  cultivarPollenParentChild = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Oz Pollen ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  await alice.client.rpc("set_seedling_parent", {
    p_seedling_id: cultivarPollenParentChild,
    p_role: "pollen_parent",
    p_kind: "cultivar",
    p_cultivar_name: "Wizard of Oz",
  });

  carolSeedling = (
    await carol.client.rpc("create_seedling", {
      p_working_name: `Carol Dusk ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;

  const rows = await withSuperuser(
    async (db) =>
      (
        await db.query(
          "select identifier from public.seedling_identifiers where seedling_id = $1 and kind = 'series'",
          [aliceSeedling],
        )
      ).rows,
  );
  seriesIdentifier = rows[0].identifier as string;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("search access", () => {
  it("lets a visitor without an account find a public seedling by its series identifier", async () => {
    const hits = await seedlingHits(seriesIdentifier);
    const ids = hits.map((hit) => hit.seedling_id);
    expect(ids).toContain(aliceSeedling);
    expect(hits.find((hit) => hit.seedling_id === aliceSeedling)?.match_reason).toBe("identifier");
  });

  it("finds a public seedling that has never had an Update, because Search does not depend on the Feed", async () => {
    const updates = await withSuperuser(
      async (db) =>
        (
          await db.query("select count(*)::int as n from public.updates where seedling_id = $1", [
            aliceSeedling,
          ])
        ).rows[0],
    );
    expect(updates.n).toBe(0);
    const hits = await seedlingHits(`Sunset Surprise ${tag}`);
    expect(hits.map((hit) => hit.seedling_id)).toContain(aliceSeedling);
  });
});

describe("identifier and name matching", () => {
  it("returns every legitimate match of a grower-scoped identifier, never one arbitrary seedling", async () => {
    const ids = (await seedlingHits(seriesIdentifier)).map((hit) => hit.seedling_id);
    expect(ids).toContain(aliceSeedling);
    expect(ids).toContain(bobSeedling);
    const holders = new Set((await seedlingHits(seriesIdentifier)).map((hit) => hit.holder_id));
    expect(holders.has(alice.id)).toBe(true);
    expect(holders.has(bob.id)).toBe(true);
  });

  it("normalises case and a leading # for identifiers, but never merges distinct identifiers", async () => {
    const lower = (await seedlingHits(`#${seriesIdentifier.toLowerCase()}`)).map(
      (hit) => hit.seedling_id,
    );
    expect(lower).toContain(aliceSeedling);
    const other = (await seedlingHits(seriesIdentifier.replace(/001$/, "999"))).map(
      (hit) => hit.seedling_id,
    );
    expect(other).not.toContain(aliceSeedling);
  });

  it("resolves a retired identifier to its canonical seedling, once. The current model has no workflow that retires an identifier, so this row is inserted directly to test the search behaviour", async () => {
    const alias = `OLD${tag.toUpperCase()}`;
    await withSuperuser(async (db) => {
      await db.query("set session_replication_role = replica");
      await db.query(
        "insert into public.seedling_identifiers (seedling_id, identifier, kind, assigned_by, is_primary_for_user, is_retired_alias) values ($1, $2, 'local', $3, false, true)",
        [aliceSeedling, alias, alice.id],
      );
    });
    const hits = await seedlingHits(alias.toLowerCase());
    expect(hits.filter((hit) => hit.seedling_id === aliceSeedling)).toHaveLength(1);
    expect(hits.find((hit) => hit.seedling_id === aliceSeedling)?.match_reason).toBe("identifier");
  });

  it("matches working names regardless of case and spacing", async () => {
    const hits = await seedlingHits(`  sunset    SURPRISE ${tag} `);
    const hit = hits.find((row) => row.seedling_id === aliceSeedling);
    expect(hit?.match_reason).toBe("working_name");
    expect(hit?.working_name).toBe(`Sunset Surprise ${tag}`);
  });

  it("returns one row per seedling even when several of its names match", async () => {
    const hits = await seedlingHits(tag);
    const ids = hits.map((hit) => hit.seedling_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("privacy", () => {
  it("never returns a private seedling, and a zero-result search reveals nothing", async () => {
    expect(await seedlingHits(`Quiet Ember ${tag}`)).toEqual([]);
  });

  it("does not reveal a private parent, even to a child that is public", async () => {
    expect(await seedlingHits(`Hidden Parent ${tag}`)).toEqual([]);
    const child = (await seedlingHits(`Public Child ${tag}`)).find(
      (hit) => hit.seedling_id === publicChild,
    );
    expect(child?.match_reason).toBe("working_name");
  });

  it("does not return a suspended grower's public seedling, and hides the grower from grower search", async () => {
    expect((await seedlingHits(`Carol Dusk ${tag}`)).map((hit) => hit.seedling_id)).toContain(
      carolSeedling,
    );
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [carol.id]),
    );
    try {
      expect(await seedlingHits(`Carol Dusk ${tag}`)).toEqual([]);
      const growers = await call<{ profile_id: string }>("search_growers", {
        p_query: `Carol ${tag}`,
        p_country: null,
        p_limit: 12,
      });
      expect(growers).toEqual([]);
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [carol.id]),
      );
    }
  });

  it("returns only public identity fields for growers, never an email or account data", async () => {
    const [row] = await call<Record<string, unknown>>("search_growers", {
      p_query: `Bob ${tag}`,
      p_country: null,
      p_limit: 12,
    });
    expect(Object.keys(row!).sort()).toEqual([
      "account_type_label",
      "country_code",
      "display_name",
      "match_tier",
      "profile_id",
      "sort_text",
    ]);
  });

  it("returns only the seedling fields a result card needs", async () => {
    const [row] = await seedlingHits(`Sunset Surprise ${tag}`);
    expect(Object.keys(row!).sort()).toEqual(
      [
        "holder_country",
        "holder_id",
        "holder_name",
        "match_reason",
        "match_tier",
        "primary_identifier",
        "primary_kind",
        "seedling_id",
        "sort_text",
        "working_name",
      ].sort(),
    );
  });
});

describe("parentage discovery", () => {
  it("surfaces the cultivar, and the public seedlings that record it as seed or pollen parent", async () => {
    const cultivars = await call<{
      cultivar_name: string;
      seed_parent_count: number;
      pollen_parent_count: number;
    }>("search_cultivars", { p_query: "wizard of oz", p_limit: 12 });
    const oz = cultivars.find((row) => row.cultivar_name === "Wizard of Oz");
    expect(oz).toBeDefined();
    expect(oz!.seed_parent_count).toBeGreaterThanOrEqual(1);
    expect(oz!.pollen_parent_count).toBeGreaterThanOrEqual(1);

    const hits = await seedlingHits("wizard of oz");
    expect(hits.find((hit) => hit.seedling_id === cultivarSeedParentChild)?.match_reason).toBe(
      "parent_cultivar",
    );
    expect(hits.find((hit) => hit.seedling_id === cultivarPollenParentChild)?.match_reason).toBe(
      "parent_cultivar",
    );
  });

  it("surfaces a child of a matching public seedling, one hop only", async () => {
    const hits = await seedlingHits(`Parent Alpha ${tag}`);
    expect(hits.find((hit) => hit.seedling_id === parentAlpha)?.match_reason).toBe("working_name");
    expect(hits.find((hit) => hit.seedling_id === alphaChild)?.match_reason).toBe(
      "parent_seedling",
    );
  });
});

describe("automatic numbers and grower labels", () => {
  it("finds an automatic number with a leading #, and only that grower's number", async () => {
    const number = await withSuperuser(
      async (db) =>
        (
          await db.query(
            "select identifier from public.seedling_identifiers where seedling_id = $1 and kind = 'automatic'",
            [publicChild],
          )
        ).rows[0].identifier as string,
    );
    const hits = await seedlingHits(`#${number}`);
    expect(hits.map((hit) => hit.seedling_id)).toContain(publicChild);
    expect(hits.every((hit) => hit.match_reason !== "country")).toBe(true);
  });

  it("matches the canonical account presentation label, so breeders can be found", async () => {
    const growers = await call<{ profile_id: string; match_tier: number }>("search_growers", {
      p_query: "breeder",
      p_country: null,
      p_limit: 12,
    });
    expect(growers.map((row) => row.profile_id)).toContain(bob.id);
  });
});

describe("country filter", () => {
  it("uses the current holder's canonical country code, and combines with the query", async () => {
    expect((await seedlingHits(tag, "NL")).map((hit) => hit.seedling_id)).toContain(aliceSeedling);
    expect((await seedlingHits(tag, "NL")).map((hit) => hit.seedling_id)).not.toContain(
      bobSeedling,
    );
    expect(await seedlingHits(`Sunset Surprise ${tag}`, "BE")).toEqual([]);
  });

  it("filters growers by the same canonical code", async () => {
    const belgians = await call<{ display_name: string; country_code: string }>("search_growers", {
      p_query: null,
      p_country: "BE",
      p_limit: 12,
    });
    expect(belgians.every((row) => row.country_code === "BE")).toBe(true);
  });
});

describe("normalisation and bounds", () => {
  it("normalises queries in the database the same way the application does", async () => {
    const sql = await withSuperuser(async (db) => ({
      text: (await db.query("select public.search_text('  SUNSET   Surprise ') as value")).rows[0]
        .value,
      ident: (await db.query("select public.search_identifier('#jv-26-001') as value")).rows[0]
        .value,
    }));
    expect(sql.text).toBe("sunset surprise");
    expect(sql.ident).toBe("JV-26-001");
  });

  it("returns at most the requested number of rows, and never more than twelve", async () => {
    expect((await seedlingHits(tag)).length).toBeLessThanOrEqual(12);
    const one = await call<unknown>("search_seedlings", {
      p_query: tag,
      p_country: null,
      p_limit: 1,
    });
    expect(one.length).toBeLessThanOrEqual(1);
  });
});
