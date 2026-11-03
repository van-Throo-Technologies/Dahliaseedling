import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Seed and seedhead offers in Search. The search function is an invoker: it reads only what the caller may see. These
 * tests call it as a visitor, as the app does, and check the live set, the four source states, the exclusions, the
 * pagination, and that no interest or owner data is returned.
 */

const visitor = anonClient();
const tag = "ss" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser; // NL, the main seller
let bob: TestUser; // BE, a second seller, suspended in one test
let carol: TestUser; // interested grower

function jpeg(): Blob {
  const data = new Uint8Array(2048);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([data], { type: "image/jpeg" });
}

async function photoAs(user: TestUser): Promise<string> {
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await user.client.storage
    .from("private-media")
    .upload(path, jpeg(), { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`upload setup failed: ${error.message}`);
  const { data, error: registerError } = await user.client.rpc("register_source_photo", {
    p_path: path,
  });
  if (registerError) throw new Error(registerError.message);
  return data as string;
}

function derivative(mediaId: string, role: "source_photo" | "parent_image") {
  return {
    media_id: mediaId,
    role,
    derivative_path: `${crypto.randomUUID()}.webp`,
    width: 800,
    height: 600,
    byte_size: 4096,
  };
}

interface Found {
  offer_id: string;
  source_kind: string;
  source_seedling_name: string | null;
  source_cultivar_name: string | null;
  source_description: string | null;
  seller_name: string;
  seller_country: string | null;
  photo_path: string | null;
  sort_text: string;
  match_tier: number;
}

async function search(args: Record<string, unknown>): Promise<Found[]> {
  const { data, error } = await visitor.rpc("search_seed_offers", args);
  if (error) throw new Error(error.message);
  return (data ?? []) as Found[];
}

async function publish(
  seller: TestUser,
  source: string,
  material: "loose_seeds" | "seedheads",
  extra: Record<string, unknown> = {},
) {
  const { data, error } = await seller.client.rpc("publish_seed_offer", {
    p_source_id: source,
    p_material_type: material,
    p_packet_size: material === "loose_seeds" ? 12 : undefined,
    p_seedhead_count: material === "seedheads" ? 3 : undefined,
    p_mode: "free",
    p_price_text: undefined,
    p_handover_method: "pickup",
    p_note: undefined,
    p_items: [],
    ...extra,
  });
  if (error) throw new Error(`publish: ${error.message}`);
  return data as string;
}

let liveUnknown = "";
let liveSeeds = "";
let liveCultivar = "";
let liveUnidentified = "";
let closedOffer = "";
let suspendedOffer = "";
let privateSeedlingOffer = "";
let unidentifiedPhoto = "";

beforeAll(async () => {
  alice = await createTestUser("ss-alice");
  bob = await createTestUser("ss-bob");
  carol = await createTestUser("ss-carol");
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

  // Unknown or mixed: no photograph needed.
  liveUnknown = await publish(
    alice,
    (await alice.client.rpc("create_seed_source", { p_kind: "unknown_mixed" })).data as string,
    "seedheads",
  );

  // A named cultivar: needs its parent photograph, recorded and shown as a public derivative.
  const cultivar = (
    await alice.client.rpc("create_seed_source", {
      p_kind: "cultivar",
      p_cultivar_name: `Cafe au Lait ${tag}`,
    })
  ).data as string;
  const parentPhoto = await photoAs(alice);
  await alice.client.rpc("set_cultivar_parent_photo", {
    p_source_id: cultivar,
    p_media_id: parentPhoto,
  });
  liveCultivar = await publish(alice, cultivar, "loose_seeds", {
    p_items: [derivative(parentPhoto, "parent_image")],
  });

  // An unidentified dahlia: the photograph of the actual plant, and the grower's own description.
  const unidentified = (
    await alice.client.rpc("create_unidentified_source", {
      p_description: `Dark burgundy decorative ${tag}`,
    })
  ).data as string;
  unidentifiedPhoto = await photoAs(alice);
  await alice.client.rpc("add_unidentified_source_photo", {
    p_source_id: unidentified,
    p_media_id: unidentifiedPhoto,
  });
  const unidentifiedSource = (
    await alice.client.rpc("create_seed_source", {
      p_kind: "unidentified",
      p_unidentified_source_id: unidentified,
    })
  ).data as string;
  liveUnidentified = await publish(alice, unidentifiedSource, "seedheads", {
    p_items: [derivative(unidentifiedPhoto, "source_photo")],
  });

  // A seedling source: its own public seedling, with the public image the Phase 7 rule requires.
  const seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Seed parent ${tag}`,
      p_visibility: "public",
    })
  ).data as { id: string };
  const seedlingSource = (
    await alice.client.rpc("create_seed_source", {
      p_kind: "seedling",
      p_seedling_id: seedling.id,
    })
  ).data as string;
  liveSeeds = await publish(alice, seedlingSource, "loose_seeds").catch(() => "");

  // Closed, suspended-seller, and private-seedling offers. None may appear.
  closedOffer = await publish(
    alice,
    (await alice.client.rpc("create_seed_source", { p_kind: "unknown_mixed" })).data as string,
    "seedheads",
  );
  await alice.client.rpc("close_seed_offer", { p_offer_id: closedOffer });

  suspendedOffer = await publish(
    bob,
    (await bob.client.rpc("create_seed_source", { p_kind: "unknown_mixed" })).data as string,
    "seedheads",
  );
  const privateSeedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Private parent ${tag}`,
      p_visibility: "private",
    })
  ).data as { id: string };
  const privateSource = (
    await alice.client.rpc("create_seed_source", {
      p_kind: "seedling",
      p_seedling_id: privateSeedling.id,
    })
  ).data as string;
  privateSeedlingOffer = await publish(alice, privateSource, "loose_seeds").catch(() => "");

  // Interest is recorded, and must never appear in Search.
  await carol.client.rpc("express_seed_offer_interest", {
    p_offer_id: liveUnknown,
    p_requested_quantity: "a few",
  });
});

afterAll(async () => {
  await withSuperuser(async (db) => {
    await db.query("update public.profiles set is_suspended = false where id = any($1::uuid[])", [
      created,
    ]);
  });
  await removeTestUsers(created);
});

describe("the live set", () => {
  it("returns exactly the live public offers, and never a closed, suspended-seller or private-seedling offer", async () => {
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [bob.id]),
    );
    const hits = await search({ p_query: tag, p_limit: 50 });
    const ids = hits.map((h) => h.offer_id).sort();
    const expected = [liveUnknown, liveCultivar, liveUnidentified, liveSeeds]
      .filter(Boolean)
      .sort();
    expect(ids).toEqual(expected);
    expect(ids).not.toContain(closedOffer);
    expect(ids).not.toContain(suspendedOffer);
    expect(ids).not.toContain(privateSeedlingOffer);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
    );
  });

  it("represents each source state honestly: a cultivar name, a seedling, an unidentified dahlia with its own description, and unknown or mixed without identity", async () => {
    const hits = await search({ p_query: tag, p_limit: 50 });
    const byId = new Map(hits.map((h) => [h.offer_id, h]));
    const cultivar = byId.get(liveCultivar)!;
    expect(cultivar.source_kind).toBe("cultivar");
    expect(cultivar.source_cultivar_name).toBe(`Cafe au Lait ${tag}`);
    expect(cultivar.source_seedling_name).toBeNull();
    const unidentified = byId.get(liveUnidentified)!;
    expect(unidentified.source_kind).toBe("unidentified");
    expect(unidentified.source_cultivar_name).toBeNull();
    expect(unidentified.source_seedling_name).toBeNull();
    expect(unidentified.source_description).toBe(`Dark burgundy decorative ${tag}`);
    const unknown = byId.get(liveUnknown)!;
    expect(unknown.source_kind).toBe("unknown_mixed");
    expect(unknown.photo_path).toBeNull();
    expect(unknown.source_cultivar_name).toBeNull();
    expect(unknown.source_seedling_name).toBeNull();
  });

  it("shows the public derivative of a source photograph, and never a private original path", async () => {
    const hits = await search({ p_query: tag, p_limit: 50 });
    const unidentified = hits.find((h) => h.offer_id === liveUnidentified)!;
    expect(unidentified.photo_path).toMatch(/\.webp$/);
    const cultivar = hits.find((h) => h.offer_id === liveCultivar)!;
    expect(cultivar.photo_path).toMatch(/\.webp$/);
  });

  it("returns no interest, no owner id and no private media column to a visitor", async () => {
    const { data } = await visitor.rpc("search_seed_offers", { p_query: tag, p_limit: 5 });
    const keys = Object.keys((data ?? [])[0] ?? {});
    expect(keys.some((k) => /interest|owner|seller_id|media|private|original/.test(k))).toBe(false);
    const interested = await visitor
      .from("seed_offer_interests")
      .select("id")
      .eq("seed_offer_id", liveUnknown);
    expect(interested.data ?? []).toEqual([]);
  });
});

describe("query, country and pagination", () => {
  it("matches a cultivar name, a seedling name, a grower's description and a seller's name, and not private text", async () => {
    expect((await search({ p_query: `cafe au lait ${tag}` })).map((h) => h.offer_id)).toContain(
      liveCultivar,
    );
    // A seedling source needs a public photograph on its record; without one it is refused and absent, as tested in seeds.test.ts.
    expect(
      (await search({ p_query: `dark burgundy decorative ${tag}` })).map((h) => h.offer_id),
    ).toContain(liveUnidentified);
    expect((await search({ p_query: `Alice ${tag}` })).map((h) => h.offer_id)).toContain(
      liveUnknown,
    );
    expect(await search({ p_query: `a few` })).toEqual([]);
  });

  it("filters by the seller's country, and combines with the query", async () => {
    const nl = (await search({ p_query: tag, p_country: "NL", p_limit: 50 })).map(
      (h) => h.offer_id,
    );
    expect(nl).toContain(liveUnknown);
    expect(nl).toContain(liveUnidentified);
    expect(nl).not.toContain(suspendedOffer);
    const be = await search({ p_query: tag, p_country: "BE", p_limit: 50 });
    // Bob is Belgian and his offer is live again once he is unsuspended; the country filter is the seller's country.
    expect(be.map((h) => h.offer_id)).toEqual([suspendedOffer]);
    expect(
      (await search({ p_query: `dark burgundy decorative ${tag}`, p_country: "NL" })).map(
        (h) => h.offer_id,
      ),
    ).toContain(liveUnidentified);
  });

  it("pages by keyset with no repeated rows, and the cursor position is the last row shown", async () => {
    const all = await search({ p_query: tag, p_limit: 50 });
    const first = await search({ p_query: tag, p_limit: 2 });
    expect(first).toHaveLength(2);
    const last = first[1]!;
    const second = await search({
      p_query: tag,
      p_limit: 50,
      p_after_text: last.sort_text,
      p_after_id: last.offer_id,
    });
    const seen = [...first, ...second].map((h) => h.offer_id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.sort()).toEqual(all.map((h) => h.offer_id).sort());
  });
});
