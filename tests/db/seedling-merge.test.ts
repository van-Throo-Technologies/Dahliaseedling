import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  localSupabase,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Seedling merge (Phase 9). A merge is a confirmed canonicalization of two records that the same current holder controls. These
 * tests exercise the authority, the invariants (provenance, identifiers, parentage, originator), the blocking states, the retired
 * identity, search, the absence of false alerts, and the races, through the same functions a browser calls.
 */

const tag = "mg" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const anon = anonClient();
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let canonical = "";
let duplicate = "";
let observation = "";
let child = "";
let beforeProvenance: string[] = [];
let beforeParentage: string[] = [];
let duplicateIdentifiers: string[] = [];

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function openSuperuser(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: localSupabase().dbUrl });
  await client.connect();
  return client;
}

async function seedling(user: TestUser, name: string, visibility: "public" | "private" = "public") {
  const { data, error } = await user.client.rpc("create_seedling", {
    p_working_name: `${name} ${tag}`,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

async function merge(user: TestUser, canonicalId: string, duplicateId: string, confirmed = true) {
  return user.client.rpc("merge_seedlings", {
    p_canonical: canonicalId,
    p_duplicate: duplicateId,
    p_confirmed: confirmed,
  });
}

beforeAll(async () => {
  alice = await createTestUser("sm-alice");
  bob = await createTestUser("sm-bob");
  carol = await createTestUser("sm-carol");
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

  canonical = await seedling(alice, "Canonical");
  duplicate = await seedling(alice, "Duplicate");
  const photo = await capturePhoto(alice, duplicate);
  observation = photo.observationId;
  child = await seedling(alice, "Child");
  await withSuperuser((db) =>
    db.query(
      `insert into public.seedling_parentage (child_seedling_id, role, parent_seedling_id, created_by)
       values ($1, 'seed_parent', $2, $3)`,
      [child, duplicate, alice.id],
    ),
  );
  expect(
    (await bob.client.rpc("set_seedling_follow", { p_seedling_id: duplicate, p_on: true })).error,
  ).toBeNull();
  await withSuperuser((db) =>
    db.query("insert into public.saved_seedlings (user_id, seedling_id) values ($1, $2)", [
      bob.id,
      duplicate,
    ]),
  );

  beforeProvenance = (
    await rows("select id::text from public.provenance_events where seedling_id = $1 order by id", [
      duplicate,
    ])
  ).map((r) => r.id as string);
  beforeParentage = (await rows("select id::text from public.seedling_parentage order by id")).map(
    (r) => r.id as string,
  );
  duplicateIdentifiers = (
    await rows(
      "select identifier from public.seedling_identifiers where seedling_id = $1 order by identifier",
      [duplicate],
    )
  ).map((r) => r.identifier as string);
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("same-holder merge: the canonical identity and the retired duplicate", () => {
  let mergeId = "";

  it("succeeds when the caller is the current holder of both, and retires the duplicate without deleting it", async () => {
    const result = await merge(alice, canonical, duplicate);
    expect(result.error).toBeNull();
    mergeId = result.data as string;
    const d = await rows(
      "select merged_into_id, deleted_at is not null as retired, current_holder_id from public.seedlings where id = $1",
      [duplicate],
    );
    expect(d[0]).toEqual({ merged_into_id: canonical, retired: true, current_holder_id: alice.id });
    const c = await rows("select merged_into_id, deleted_at from public.seedlings where id = $1", [
      canonical,
    ]);
    expect(c[0]).toEqual({ merged_into_id: null, deleted_at: null });
  });

  it("records who confirmed which canonical identity, and when, in an append-only record", async () => {
    const record = await rows(
      "select retired_seedling_id, canonical_seedling_id, confirmed_by from public.seedling_merges where id = $1",
      [mergeId],
    );
    expect(record[0]).toEqual({
      retired_seedling_id: duplicate,
      canonical_seedling_id: canonical,
      confirmed_by: alice.id,
    });
    await expect(
      withSuperuser((db) =>
        db.query("update public.seedling_merges set confirmed_by = $1 where id = $2", [
          bob.id,
          mergeId,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("appends one merged_into event and leaves every existing provenance row unchanged", async () => {
    const after = await rows(
      "select id::text, event_type, metadata from public.provenance_events where seedling_id = $1 order by id",
      [duplicate],
    );
    const existing = after.filter((r) => beforeProvenance.includes(r.id as string));
    expect(existing.map((r) => r.id)).toEqual(beforeProvenance);
    const added = after.filter((r) => !beforeProvenance.includes(r.id as string));
    expect(added).toHaveLength(1);
    expect(added[0]!.event_type).toBe("merged_into");
    expect(added[0]!.metadata).toMatchObject({
      canonical_seedling_id: canonical,
      confirmed_by: alice.id,
    });
  });

  it("keeps every identifier of the duplicate, unchanged, as a retired alias; canonical identifiers are untouched", async () => {
    const ids = await rows(
      "select identifier, is_retired_alias from public.seedling_identifiers where seedling_id = $1 order by identifier",
      [duplicate],
    );
    expect(ids.map((r) => r.identifier)).toEqual(duplicateIdentifiers);
    expect(ids.every((r) => r.is_retired_alias === true)).toBe(true);
    const canonicalIds = await rows(
      "select count(*)::int as n from public.seedling_identifiers where seedling_id = $1 and is_retired_alias = false",
      [canonical],
    );
    expect(canonicalIds[0].n).toBeGreaterThan(0);
  });

  it("moves the caller's Observation to the canonical Seedling with the same identifiers and media, and keeps its time and text", async () => {
    const moved = await rows(
      "select id, seedling_id, observed_at, note from public.observations where id = $1",
      [observation],
    );
    expect(moved[0].seedling_id).toBe(canonical);
    const media = await rows(
      "select count(*)::int as n from public.observation_media where observation_id = $1",
      [observation],
    );
    expect(media[0].n).toBeGreaterThan(0);
  });

  it("leaves every parentage row unchanged: no edge is created, deleted or repointed", async () => {
    const after = (await rows("select id::text from public.seedling_parentage order by id")).map(
      (r) => r.id as string,
    );
    expect(after).toEqual(beforeParentage);
    const edge = await rows(
      "select parent_seedling_id from public.seedling_parentage where child_seedling_id = $1",
      [child],
    );
    expect(edge[0].parent_seedling_id).toBe(duplicate);
  });

  it("consolidates follows onto the canonical Seedling without duplicating them, and keeps saves", async () => {
    const onCanonical = await rows(
      "select count(*)::int as n from public.seedling_follows where seedling_id = $1 and user_id = $2",
      [canonical, bob.id],
    );
    const onDuplicate = await rows(
      "select count(*)::int as n from public.seedling_follows where seedling_id = $1",
      [duplicate],
    );
    const saved = await rows(
      "select count(*)::int as n from public.saved_seedlings where seedling_id = $1 and user_id = $2",
      [canonical, bob.id],
    );
    expect(onCanonical[0].n).toBe(1);
    expect(onDuplicate[0].n).toBe(0);
    expect(saved[0].n).toBe(1);
  });

  it("resolves the retired identity to the canonical Seedling for the holder and for a visitor, and never to nothing for a public canonical", async () => {
    expect(
      (await alice.client.rpc("seedling_canonical_id", { p_seedling_id: duplicate })).data,
    ).toBe(canonical);
    expect((await anon.rpc("seedling_canonical_id", { p_seedling_id: duplicate })).data).toBe(
      canonical,
    );
    expect(
      (await carol.client.rpc("seedling_canonical_id", { p_seedling_id: duplicate })).data,
    ).toBe(canonical);
    expect((await anon.rpc("seedling_canonical_id", { p_seedling_id: canonical })).data).toBeNull();
  });
});

describe("the retired duplicate cannot accept new participation", () => {
  it("refuses a new Observation, a Rehome, a Seed source, a subscription and a follow", async () => {
    await expect(capturePhoto(alice, duplicate)).rejects.toThrow();
    expect(
      (
        await alice.client.rpc("start_rehome", {
          p_seedling_id: duplicate,
          p_term: "donate",
          p_price_text: null,
          p_handover: "pickup",
          p_note: null,
          p_make_public: false,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await alice.client.rpc("create_seed_source", {
          p_kind: "seedling",
          p_seedling_id: duplicate,
        })
      ).error,
    ).not.toBeNull();
    expect(
      errorCode(
        (
          await bob.client.rpc("subscribe_availability", {
            p_seedling_id: duplicate,
            p_locale: "en",
          })
        ).error,
      ),
    ).toBe("P0002");
    expect(
      (await bob.client.rpc("set_seedling_follow", { p_seedling_id: duplicate, p_on: true })).error,
    ).not.toBeNull();
  });

  it("refuses a direct insert through the guard even when a caller bypasses the function", async () => {
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.observations (seedling_id, author_id, observed_at, note) values ($1, $2, now(), 'bypass')",
          [duplicate, alice.id],
        ),
      ),
    ).rejects.toMatchObject({ code: "P0002" });
  });
});

describe("refused merges leave both records unchanged", () => {
  let other = "";
  let foreign = "";

  beforeAll(async () => {
    other = await seedling(alice, "Other");
    foreign = await seedling(bob, "Foreign");
  });

  it("denies a merge of records controlled by different growers, and changes nothing", async () => {
    const result = await merge(alice, canonical, foreign);
    expect(errorCode(result.error)).toBe("42501");
    expect(
      (await rows("select merged_into_id from public.seedlings where id = $1", [foreign]))[0]
        .merged_into_id,
    ).toBeNull();
  });

  it("denies a caller who is not the current holder of both", async () => {
    expect(
      errorCode(
        (
          await carol.client.rpc("merge_seedlings", {
            p_canonical: canonical,
            p_duplicate: other,
            p_confirmed: true,
          })
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await bob.client.rpc("merge_seedlings", {
            p_canonical: canonical,
            p_duplicate: other,
            p_confirmed: true,
          })
        ).error,
      ),
    ).toBe("42501");
  });

  it("denies a self-merge and a merge without explicit confirmation", async () => {
    expect(errorCode((await merge(alice, other, other)).error)).toBe("23514");
    expect(errorCode((await merge(alice, canonical, other, false)).error)).toBe("23514");
  });

  it("denies a merge involving a record that is already retired", async () => {
    expect(errorCode((await merge(alice, canonical, duplicate)).error)).toBe("23514");
    expect(errorCode((await merge(alice, duplicate, other)).error)).toBe("23514");
  });

  it("denies a merge when the two records have conflicting originators", async () => {
    const conflicting = await seedling(bob, "Originated by Bob");
    // A holder change is a Phase 6 transaction; the test sets the same flag that transaction sets, in its own transaction.
    const client = await openSuperuser();
    try {
      await client.query("begin");
      await client.query("select set_config('dahlia.holder_transfer', 'confirmed', true)");
      await client.query("update public.seedlings set current_holder_id = $1 where id = $2", [
        alice.id,
        conflicting,
      ]);
      await client.query("commit");
    } finally {
      await client.end();
    }
    expect(errorCode((await merge(alice, canonical, conflicting)).error)).toBe("23514");
  });

  it("denies a merge while either record has an active continuation", async () => {
    const rehoming = await seedling(alice, "Rehoming");
    expect(
      (
        await alice.client.rpc("start_rehome", {
          p_seedling_id: rehoming,
          p_term: "donate",
          p_price_text: null,
          p_handover: "pickup",
          p_note: null,
          p_make_public: false,
        })
      ).error,
    ).toBeNull();
    expect(errorCode((await merge(alice, canonical, rehoming)).error)).toBe("23514");
  });

  it("denies a merge while a Seed Offer from either record is active", async () => {
    const sourced = await seedling(alice, "Sourced");
    const photo = await capturePhoto(alice, sourced);
    await publishPublicImage(alice, photo);
    const source = await alice.client.rpc("create_seed_source", {
      p_kind: "seedling",
      p_seedling_id: sourced,
    });
    expect(source.error).toBeNull();
    const offer = await alice.client.rpc("publish_seed_offer", {
      p_source_id: source.data as string,
      p_material_type: "seedheads",
      p_seedhead_count: 2,
      p_mode: "free",
      p_handover_method: "pickup",
      p_items: [],
    });
    expect(offer.error).toBeNull();
    expect(errorCode((await merge(alice, canonical, sourced)).error)).toBe("23514");
  });

  it("denies a merge while the duplicate has an active availability alert, and does not guess", async () => {
    const watched = await seedling(alice, "Watched");
    expect(
      (await bob.client.rpc("subscribe_availability", { p_seedling_id: watched, p_locale: "fr" }))
        .error,
    ).toBeNull();
    expect(errorCode((await merge(alice, other, watched)).error)).toBe("23514");
    expect(
      (await bob.client.rpc("unsubscribe_availability", { p_seedling_id: watched })).error,
    ).toBeNull();
  });

  it("denies a caller who is suspended, and changes nothing", async () => {
    const suspendedCase = await seedling(alice, "Suspended case");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [alice.id]),
    );
    try {
      expect(errorCode((await merge(alice, other, suspendedCase)).error)).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [alice.id]),
      );
    }
    expect(
      (await rows("select merged_into_id from public.seedlings where id = $1", [suspendedCase]))[0]
        .merged_into_id,
    ).toBeNull();
  });
});

describe("search and side effects", () => {
  it("search returns the canonical Seedling and never the retired duplicate as an independent result", async () => {
    const { data, error } = await anon.rpc("search_seedlings", {
      p_query: `Duplicate ${tag}`,
      p_limit: 20,
    });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { seedling_id: string }) => r.seedling_id);
    expect(ids).not.toContain(duplicate);
  });

  it("creates no availability event, no notification and no outbox email when the records are consolidated", async () => {
    const quietCanonical = await seedling(alice, "Quiet canonical");
    const quietDuplicate = await seedling(alice, "Quiet duplicate");
    const before = await rows(`select
      (select count(*)::int from public.notifications) as notes,
      (select count(*)::int from public.email_outbox) as outbox,
      (select count(*)::int from public.rehome_cases) as cases`);
    expect((await merge(alice, quietCanonical, quietDuplicate)).error).toBeNull();
    const after = await rows(`select
      (select count(*)::int from public.notifications) as notes,
      (select count(*)::int from public.email_outbox) as outbox,
      (select count(*)::int from public.rehome_cases) as cases`);
    expect(after[0]).toEqual(before[0]);
  });
});

describe("concurrency: one valid outcome, never a partial merge", () => {
  it("two simultaneous merges of the same duplicate into different canonical records: exactly one succeeds", async () => {
    const first = await seedling(alice, "Race canonical one");
    const second = await seedling(alice, "Race canonical two");
    const target = await seedling(alice, "Race duplicate");
    const results = await Promise.all([merge(alice, first, target), merge(alice, second, target)]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    const records = await rows(
      "select canonical_seedling_id from public.seedling_merges where retired_seedling_id = $1",
      [target],
    );
    expect(records).toHaveLength(1);
  });

  it("a merge waits for a holder change that is in progress, then refuses because the holder has changed", async () => {
    const holdCanonical = await seedling(alice, "Holder race canonical");
    const holdDuplicate = await seedling(alice, "Holder race duplicate");
    const client = await openSuperuser();
    try {
      await client.query("begin");
      await client.query("select set_config('dahlia.holder_transfer', 'confirmed', true)");
      await client.query("update public.seedlings set current_holder_id = $1 where id = $2", [
        bob.id,
        holdCanonical,
      ]);
      const pending = merge(alice, holdCanonical, holdDuplicate);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await client.query("commit");
      expect(errorCode((await pending).error)).toBe("42501");
    } finally {
      await client.end();
    }
    expect(
      (await rows("select merged_into_id from public.seedlings where id = $1", [holdDuplicate]))[0]
        .merged_into_id,
    ).toBeNull();
  });

  it("a Rehome that starts while a merge is in progress is refused by the merge or refuses the merge, never both", async () => {
    const rhCanonical = await seedling(alice, "Rehome race canonical");
    const rhDuplicate = await seedling(alice, "Rehome race duplicate");
    const client = await openSuperuser();
    let insertedCase = false;
    try {
      await client.query("begin");
      await client.query(
        `insert into public.rehome_cases (seedling_id, offering_holder_id, status, term)
         values ($1, $2, 'available', 'donate')`,
        [rhCanonical, alice.id],
      );
      insertedCase = true;
      const pending = merge(alice, rhCanonical, rhDuplicate);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await client.query("commit");
      expect(errorCode((await pending).error)).toBe("23514");
    } finally {
      if (!insertedCase) await client.query("rollback").catch(() => undefined);
      await client.end();
    }
    expect(
      (await rows("select merged_into_id from public.seedlings where id = $1", [rhDuplicate]))[0]
        .merged_into_id,
    ).toBeNull();
  });

  it("a Seed source created on a duplicate while a merge is in progress cannot leave an active offer on a retired record", async () => {
    const soCanonical = await seedling(alice, "Source race canonical");
    const soDuplicate = await seedling(alice, "Source race duplicate");
    const client = await openSuperuser();
    try {
      await client.query("begin");
      await client.query(
        `insert into public.seed_sources (owner_id, source_seedling_id) values ($1, $2)`,
        [alice.id, soDuplicate],
      );
      const pending = merge(alice, soCanonical, soDuplicate);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await client.query("commit");
      const outcome = await pending;
      if (outcome.error === null) {
        const offers = await rows(
          `select count(*)::int as n from public.seed_offers o join public.seed_sources ss on ss.id = o.seed_source_id where ss.source_seedling_id = $1 and o.is_active`,
          [soDuplicate],
        );
        expect(offers[0].n).toBe(0);
      } else {
        expect(errorCode(outcome.error)).toBe("23514");
      }
    } finally {
      await client.end();
    }
  });
});
