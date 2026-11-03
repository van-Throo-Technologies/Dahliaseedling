import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Phase 7: seeds and seedheads. Seed material never receives a Seedling identity and never transfers a Seedling. A seed
 * source records one known maternal reference (a Seedling, a named cultivar, an unidentified dahlia, or unknown/mixed).
 * Each rule is enforced by the database, and each test calls the function the app calls, as the real role.
 */

const created: string[] = [];
const visitor = anonClient();
const tag = "sd" + Math.random().toString(36).slice(2, 8);
let alice: TestUser; // seller, holder of the parent seedling
let bob: TestUser; // interested grower
let carol: TestUser; // interested grower
let dave: TestUser; // suspended in one test

function jpeg(size = 2048): Blob {
  const data = new Uint8Array(size);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([data], { type: "image/jpeg" });
}

/** A real upload into the uploader's own folder, then registered as a private image. */
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

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

/** A public item for publishing: the server action would make a derivative; the function records it. */
function item(mediaId: string, role: "source_photo" | "parent_image") {
  return {
    media_id: mediaId,
    role,
    derivative_path: `${crypto.randomUUID()}.webp`,
    width: 800,
    height: 600,
    byte_size: 4096,
  };
}

async function unidentifiedWithPhoto(owner: TestUser, description: string) {
  const { data: source, error } = await owner.client.rpc("create_unidentified_source", {
    p_description: description,
  });
  if (error) throw new Error(error.message);
  const media = await photoAs(owner);
  const linked = await owner.client.rpc("add_unidentified_source_photo", {
    p_source_id: source,
    p_media_id: media,
  });
  if (linked.error) throw new Error(linked.error.message);
  return { source: source as string, media };
}

async function publicSeedling(owner: TestUser, label: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_seedling", {
    p_working_name: `${label} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

beforeAll(async () => {
  alice = await createTestUser("sd-alice");
  bob = await createTestUser("sd-bob");
  carol = await createTestUser("sd-carol");
  dave = await createTestUser("sd-dave");
  created.push(alice.id, bob.id, carol.id, dave.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });
  await carol.client
    .from("profiles")
    .insert({ id: carol.id, display_name: `Carol ${tag}`, country_code: "DE" });
  await dave.client
    .from("profiles")
    .insert({ id: dave.id, display_name: `Dave ${tag}`, country_code: "FR" });
});

afterAll(async () => {
  await rows("update public.profiles set is_suspended = false where id = any($1::uuid[])", [
    created,
  ]);
  await removeTestUsers(created);
});

describe("the four source states are exact and never fabricated", () => {
  it("an unknown or mixed source takes no reference and needs no photograph", async () => {
    const { data, error } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    expect(error).toBeNull();
    const seedRow = await rows(
      "select source_unknown_mixed, source_seedling_id, source_cultivar_id, source_unidentified_id from public.seed_sources where id = $1",
      [data],
    );
    expect(seedRow[0]).toEqual({
      source_unknown_mixed: true,
      source_seedling_id: null,
      source_cultivar_id: null,
      source_unidentified_id: null,
    });
  });

  it("an unidentified dahlia cannot become a source without a photograph of the actual plant", async () => {
    const { data: source } = await alice.client.rpc("create_unidentified_source", {
      p_description: `Dark burgundy decorative ${tag}`,
    });
    const refused = await alice.client.rpc("create_seed_source", {
      p_kind: "unidentified",
      p_unidentified_source_id: source,
    });
    expect(errorCode(refused.error)).toBe("23514");
  });

  it("an unidentified dahlia records the exact physical plant without a cultivar or a Seedling, and fabricates neither", async () => {
    const before = await rows("select count(*)::int as n from public.cultivar_references");
    const seedlingsBefore = await rows("select count(*)::int as n from public.seedlings");
    const { source } = await unidentifiedWithPhoto(alice, `Dark burgundy decorative ${tag}`);
    const { data: seedSource, error } = await alice.client.rpc("create_seed_source", {
      p_kind: "unidentified",
      p_unidentified_source_id: source,
    });
    expect(error).toBeNull();
    const row = await rows(
      "select source_unidentified_id, source_seedling_id, source_cultivar_id, source_unknown_mixed from public.seed_sources where id = $1",
      [seedSource],
    );
    expect(row[0]).toEqual({
      source_unidentified_id: source,
      source_seedling_id: null,
      source_cultivar_id: null,
      source_unknown_mixed: false,
    });
    const after = await rows("select count(*)::int as n from public.cultivar_references");
    expect(after).toEqual(before);
    const seedlingsAfter = await rows("select count(*)::int as n from public.seedlings");
    expect(seedlingsAfter).toEqual(seedlingsBefore);
  });

  it("the database refuses two references on one source", async () => {
    const seedling = await publicSeedling(alice, "Two refs");
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.seed_sources (owner_id, source_seedling_id, source_unknown_mixed) values ($1, $2, true)",
          [alice.id, seedling],
        ),
      ),
    ).rejects.toThrow(/seed_source_exactly_one_reference/);
  });

  it("a named cultivar uses the cultivar reference; it needs its own photograph before publication", async () => {
    const { data: source, error } = await alice.client.rpc("create_seed_source", {
      p_kind: "cultivar",
      p_cultivar_name: `Cafe au Lait ${tag}`,
    });
    expect(error).toBeNull();
    const offer = await alice.client.rpc("publish_seed_offer", {
      p_source_id: source,
      p_material_type: "loose_seeds",
      p_packet_size: 20,
      p_seedhead_count: null,
      p_mode: "free",
      p_price_text: null,
      p_handover_method: "pickup",
      p_note: null,
      p_items: [],
    });
    expect(errorCode(offer.error)).toBe("23514");
  });
});

describe("offers: quantity, mode and lifecycle", () => {
  it("a packet offer needs seeds per packet; a seedhead offer needs a seedhead count; never both", async () => {
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    const base = {
      p_source_id: source,
      p_mode: "free",
      p_price_text: null,
      p_handover_method: "pickup",
      p_note: null,
      p_items: [],
    };
    expect(
      errorCode(
        (
          await alice.client.rpc("publish_seed_offer", {
            ...base,
            p_material_type: "loose_seeds",
            p_packet_size: null,
            p_seedhead_count: null,
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await alice.client.rpc("publish_seed_offer", {
            ...base,
            p_material_type: "seedheads",
            p_packet_size: null,
            p_seedhead_count: 0,
          })
        ).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await alice.client.rpc("publish_seed_offer", {
            ...base,
            p_material_type: "loose_seeds",
            p_packet_size: 20,
            p_seedhead_count: 3,
          })
        ).error,
      ),
    ).toBe("23514");
    const ok = await alice.client.rpc("publish_seed_offer", {
      ...base,
      p_material_type: "seedheads",
      p_packet_size: null,
      p_seedhead_count: 3,
    });
    expect(ok.error).toBeNull();
  });

  it("a price belongs only to a sale; no stock, payment or checkout fields exist", async () => {
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    const base = {
      p_source_id: source,
      p_material_type: "loose_seeds",
      p_packet_size: 10,
      p_seedhead_count: null,
      p_handover_method: "both",
      p_note: null,
      p_items: [],
    };
    expect(
      errorCode(
        (
          await alice.client.rpc("publish_seed_offer", {
            ...base,
            p_mode: "free",
            p_price_text: "5 EUR",
          })
        ).error,
      ),
    ).toBe("23514");
    const sale = await alice.client.rpc("publish_seed_offer", {
      ...base,
      p_mode: "for_sale",
      p_price_text: "5 EUR",
    });
    expect(sale.error).toBeNull();
    const columns = await rows(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name like 'seed_%' order by column_name",
    );
    const names = columns.map((c) => c.column_name as string);
    expect(
      names
        .filter((n) => n !== "sort_order")
        .some((n) => /stock|inventory|payment|checkout|shipping_label|tracking|order/.test(n)),
    ).toBe(false);
  });

  it("closing is the seller's act, is idempotent, and leaves the source and its history in place", async () => {
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    const offer = (
      await alice.client.rpc("publish_seed_offer", {
        p_source_id: source,
        p_material_type: "loose_seeds",
        p_packet_size: 10,
        p_seedhead_count: null,
        p_mode: "trade",
        p_price_text: null,
        p_handover_method: "pickup",
        p_note: null,
        p_items: [],
      })
    ).data as string;
    expect(errorCode((await bob.client.rpc("close_seed_offer", { p_offer_id: offer })).error)).toBe(
      "P0002",
    );
    expect((await alice.client.rpc("close_seed_offer", { p_offer_id: offer })).data).toBe(true);
    expect((await alice.client.rpc("close_seed_offer", { p_offer_id: offer })).data).toBe(false);
    const still = await rows("select count(*)::int as n from public.seed_sources where id = $1", [
      source,
    ]);
    expect(still[0].n).toBe(1);
    const hidden = await visitor.from("seed_offers").select("id").eq("id", offer);
    expect(hidden.data ?? []).toEqual([]);
  });
});

describe("interest", () => {
  let offer = "";
  beforeAll(async () => {
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    offer = (
      await alice.client.rpc("publish_seed_offer", {
        p_source_id: source,
        p_material_type: "seedheads",
        p_packet_size: null,
        p_seedhead_count: 2,
        p_mode: "free",
        p_price_text: null,
        p_handover_method: "shipping",
        p_note: `Interest ${tag}`,
        p_items: [],
      })
    ).data as string;
  });

  it("a visitor, and the seller, cannot express interest; an authenticated grower can, once; the quantity is recorded", async () => {
    expect(
      errorCode(
        (
          await visitor.rpc("express_seed_offer_interest", {
            p_offer_id: offer,
            p_requested_quantity: "1",
          })
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (await alice.client.rpc("express_seed_offer_interest", { p_offer_id: offer })).error,
      ),
    ).toBe("23514");
    const first = await bob.client.rpc("express_seed_offer_interest", {
      p_offer_id: offer,
      p_requested_quantity: "1 head",
    });
    const again = await bob.client.rpc("express_seed_offer_interest", {
      p_offer_id: offer,
      p_requested_quantity: "1 head",
    });
    expect(first.data).toBe(again.data);
    const active = await rows(
      "select count(*)::int as n from public.seed_offer_interests where seed_offer_id = $1 and withdrawn_at is null",
      [offer],
    );
    expect(active[0].n).toBe(1);
  });

  it("interest is private: the seller sees who is interested, another grower does not, and nobody sees a conversation", async () => {
    await carol.client.rpc("express_seed_offer_interest", { p_offer_id: offer });
    const sellerView = await alice.client
      .from("seed_offer_interests")
      .select("interested_user_id")
      .eq("seed_offer_id", offer);
    expect(sellerView.data!.map((r) => r.interested_user_id).sort()).toEqual(
      [bob.id, carol.id].sort(),
    );
    const carolView = await carol.client
      .from("seed_offer_interests")
      .select("interested_user_id")
      .eq("seed_offer_id", offer);
    expect(carolView.data!.map((r) => r.interested_user_id)).toEqual([carol.id]);
    const visitorView = await visitor
      .from("seed_offer_interests")
      .select("id")
      .eq("seed_offer_id", offer);
    expect(visitorView.data ?? []).toEqual([]);
  });

  it("a withdrawn interest is kept, not deleted, and is no longer active", async () => {
    await bob.client.rpc("withdraw_seed_offer_interest", { p_offer_id: offer });
    const kept = await rows(
      "select count(*)::int as n, count(withdrawn_at)::int as w from public.seed_offer_interests where seed_offer_id = $1 and interested_user_id = $2",
      [offer, bob.id],
    );
    expect(kept[0]).toEqual({ n: 1, w: 1 });
    expect(
      errorCode(
        (await bob.client.rpc("withdraw_seed_offer_interest", { p_offer_id: offer })).error,
      ),
    ).toBe("P0002");
  });

  it("once the offer is closed, no new interest is accepted, and the existing record remains", async () => {
    await alice.client.rpc("close_seed_offer", { p_offer_id: offer });
    expect(
      errorCode(
        (await dave.client.rpc("express_seed_offer_interest", { p_offer_id: offer })).error,
      ),
    ).toBe("P0002");
    const remains = await rows(
      "select count(*)::int as n from public.seed_offer_interests where seed_offer_id = $1",
      [offer],
    );
    expect(remains[0].n).toBeGreaterThan(0);
  });
});

describe("visibility and privacy", () => {
  let offer = "";
  let source = "";
  let photoMedia = "";
  let derivativeIds: string[] = [];

  beforeAll(async () => {
    const made = await unidentifiedWithPhoto(alice, `Visible context ${tag}`);
    source = (
      await alice.client.rpc("create_seed_source", {
        p_kind: "unidentified",
        p_unidentified_source_id: made.source,
      })
    ).data as string;
    photoMedia = made.media;
    const published = await alice.client.rpc("publish_seed_offer", {
      p_source_id: source,
      p_material_type: "loose_seeds",
      p_packet_size: 12,
      p_seedhead_count: null,
      p_mode: "free",
      p_price_text: null,
      p_handover_method: "pickup",
      p_note: null,
      p_items: [item(photoMedia, "source_photo")],
    });
    if (published.error) throw new Error(published.error.message);
    offer = published.data as string;
    const links = await rows(
      "select derivative_id from public.seed_offer_media where offer_id = $1",
      [offer],
    );
    derivativeIds = links.map((l) => l.derivative_id as string);
  });

  it("a visitor sees the live offer and the source context, and no original photograph, owner, or private media id", async () => {
    const offers = await visitor
      .from("seed_offers")
      .select("id, material_type, mode, note")
      .eq("id", offer);
    expect(offers.data).toHaveLength(1);
    const ownerColumn = await visitor.from("seed_offers").select("seller_id").eq("id", offer);
    expect(ownerColumn.error).toBeNull();
    const sourceOwner = await visitor.from("seed_sources").select("owner_id").eq("id", source);
    expect(errorCode(sourceOwner.error)).toBe("42501");
    const originalRows = await visitor.from("unidentified_source_photos").select("media_id");
    expect(originalRows.data ?? []).toEqual([]);
    const photoRows = await visitor.from("media").select("id").eq("id", photoMedia);
    expect(photoRows.data ?? []).toEqual([]);
  });

  it("a public derivative of the source photograph is readable while the offer is live, and not after it is closed", async () => {
    const shown = await visitor.from("public_derivatives").select("id").in("id", derivativeIds);
    expect(shown.data!.length).toBe(derivativeIds.length);
    await alice.client.rpc("close_seed_offer", { p_offer_id: offer });
    const hidden = await visitor.from("public_derivatives").select("id").in("id", derivativeIds);
    expect(hidden.data ?? []).toEqual([]);
    const hiddenLinks = await visitor
      .from("seed_offer_media")
      .select("derivative_id")
      .eq("offer_id", offer);
    expect(hiddenLinks.data ?? []).toEqual([]);
  });

  it("another grower cannot read the owner's source photograph list, and the source owner still can", async () => {
    const others = await bob.client
      .from("unidentified_source_photos")
      .select("media_id")
      .eq(
        "source_id",
        (
          await rows("select source_unidentified_id from public.seed_sources where id = $1", [
            source,
          ])
        )[0].source_unidentified_id,
      );
    expect(others.data ?? []).toEqual([]);
    const ownerSees = await alice.client
      .from("unidentified_source_photos")
      .select("media_id")
      .eq(
        "source_id",
        (
          await rows("select source_unidentified_id from public.seed_sources where id = $1", [
            source,
          ])
        )[0].source_unidentified_id,
      );
    expect(ownerSees.data).toHaveLength(1);
  });

  it("an offer built on a private seedling is not public, even when the seedling holder asks", async () => {
    const { data: privateSeedling } = await alice.client.rpc("create_seedling", {
      p_working_name: `Hidden ${tag}`,
      p_visibility: "private",
    });
    const seedSource = (
      await alice.client.rpc("create_seed_source", {
        p_kind: "seedling",
        p_seedling_id: privateSeedling!.id,
      })
    ).data as string;
    const hiddenOffer = (
      await alice.client.rpc("publish_seed_offer", {
        p_source_id: seedSource,
        p_material_type: "loose_seeds",
        p_packet_size: 6,
        p_seedhead_count: null,
        p_mode: "free",
        p_price_text: null,
        p_handover_method: "pickup",
        p_note: null,
        p_items: [],
      })
    ).error;
    expect(hiddenOffer).not.toBeNull();
  });
});

describe("parentage: the unidentified dahlia and the independent pollen parent", () => {
  it("the holder records an unidentified seed parent with its photograph; the pollen parent stays independently unknown", async () => {
    const seedling = await publicSeedling(alice, "Offspring");
    const made = await unidentifiedWithPhoto(alice, `Neighbour's dahlia ${tag}`);
    const row = await alice.client.rpc("set_seedling_parent_unidentified", {
      p_seedling_id: seedling,
      p_role: "seed_parent",
      p_source_id: made.source,
      p_notes: null,
    });
    expect(row.error).toBeNull();
    const pollen = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: seedling,
      p_role: "pollen_parent",
      p_kind: "unknown",
    });
    expect(pollen.error).toBeNull();
    const stored = await rows(
      "select role, parent_unidentified_source_id, parent_seedling_id, parent_cultivar_id, is_unknown from public.seedling_parentage where child_seedling_id = $1 order by role",
      [seedling],
    );
    expect(stored).toEqual([
      // Ordered by the parent_role enum: seed_parent is declared before pollen_parent.
      {
        role: "seed_parent",
        parent_unidentified_source_id: made.source,
        parent_seedling_id: null,
        parent_cultivar_id: null,
        is_unknown: false,
      },
      {
        role: "pollen_parent",
        parent_unidentified_source_id: null,
        parent_seedling_id: null,
        parent_cultivar_id: null,
        is_unknown: true,
      },
    ]);
  });

  it("an unidentified parent needs a photograph; another grower's source is refused; no Seedling or cultivar is fabricated", async () => {
    const seedling = await publicSeedling(alice, "Refused");
    const { data: bare } = await alice.client.rpc("create_unidentified_source", {
      p_description: null,
    });
    expect(
      errorCode(
        (
          await alice.client.rpc("set_seedling_parent_unidentified", {
            p_seedling_id: seedling,
            p_role: "seed_parent",
            p_source_id: bare,
            p_notes: null,
          })
        ).error,
      ),
    ).toBe("23514");
    const made = await unidentifiedWithPhoto(alice, null as unknown as string);
    expect(
      errorCode(
        (
          await bob.client.rpc("set_seedling_parent_unidentified", {
            p_seedling_id: seedling,
            p_role: "seed_parent",
            p_source_id: made.source,
            p_notes: null,
          })
        ).error,
      ),
    ).toBe("P0002");
  });

  it("the database refuses a parent row with two references", async () => {
    const seedling = await publicSeedling(alice, "Double");
    const made = await unidentifiedWithPhoto(alice, `Double ${tag}`);
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.seedling_parentage (child_seedling_id, role, parent_unidentified_source_id, is_unknown, created_by) values ($1, 'seed_parent', $2, true, $3)",
          [seedling, made.source, alice.id],
        ),
      ),
    ).rejects.toThrow(/parentage_exactly_one_reference/);
  });

  it("the Phase 2 kinds still behave as before: unknown, a cultivar, and a seedling", async () => {
    const child = await publicSeedling(alice, "Phase two");
    const parent = await publicSeedling(alice, "Parent");
    expect(
      (
        await alice.client.rpc("set_seedling_parent", {
          p_seedling_id: child,
          p_role: "seed_parent",
          p_kind: "unknown",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await alice.client.rpc("set_seedling_parent", {
          p_seedling_id: child,
          p_role: "seed_parent",
          p_kind: "cultivar",
          p_cultivar_name: `Jowey ${tag}`,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await alice.client.rpc("set_seedling_parent", {
          p_seedling_id: child,
          p_role: "seed_parent",
          p_kind: "seedling",
          p_parent_seedling_id: parent,
        })
      ).error,
    ).toBeNull();
  });
});

describe("the offspring and the holder are never changed by seed material", () => {
  it("publishing offers, expressing interest and recording an unidentified parent leave the Seedling UUID, its holder and its originator unchanged", async () => {
    const seedling = await publicSeedling(alice, "Stable");
    const before = await rows(
      "select id, originator_id, current_holder_id from public.seedlings where id = $1",
      [seedling],
    );
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "seedling",
      p_seedling_id: seedling,
    });
    expect(source).toBeDefined();
    const made = await unidentifiedWithPhoto(alice, `Stable context ${tag}`);
    await alice.client.rpc("set_seedling_parent_unidentified", {
      p_seedling_id: seedling,
      p_role: "seed_parent",
      p_source_id: made.source,
      p_notes: null,
    });
    const after = await rows(
      "select id, originator_id, current_holder_id from public.seedlings where id = $1",
      [seedling],
    );
    expect(after).toEqual(before);
    const count = await rows("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(count[0].n).toBe(1);
  });

  it("no offer gives a grower a holder transfer, and no provenance is written by publishing or interest", async () => {
    const seedling = await publicSeedling(alice, "No transfer");
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    const offer = (
      await alice.client.rpc("publish_seed_offer", {
        p_source_id: source,
        p_material_type: "seedheads",
        p_packet_size: null,
        p_seedhead_count: 1,
        p_mode: "free",
        p_price_text: null,
        p_handover_method: "pickup",
        p_note: null,
        p_items: [],
      })
    ).data as string;
    await bob.client.rpc("express_seed_offer_interest", { p_offer_id: offer });
    const holder = await rows("select current_holder_id from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(holder[0].current_holder_id).toBe(alice.id);
    const transfers = await rows(
      "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(transfers[0].n).toBe(0);
  });
});

describe("suspension", () => {
  it("a suspended grower cannot create a source, publish, close, or express interest; an already-live offer of a newly suspended seller is hidden", async () => {
    const { data: source } = await dave.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    const live = (
      await dave.client.rpc("publish_seed_offer", {
        p_source_id: source,
        p_material_type: "seedheads",
        p_packet_size: null,
        p_seedhead_count: 4,
        p_mode: "free",
        p_price_text: null,
        p_handover_method: "pickup",
        p_note: null,
        p_items: [],
      })
    ).data as string;
    const visibleBefore = await visitor.from("seed_offers").select("id").eq("id", live);
    expect(visibleBefore.data).toHaveLength(1);

    await rows("update public.profiles set is_suspended = true where id = $1", [dave.id]);
    try {
      expect(
        errorCode((await dave.client.rpc("create_seed_source", { p_kind: "unknown_mixed" })).error),
      ).toBe("42501");
      expect(
        errorCode((await dave.client.rpc("close_seed_offer", { p_offer_id: live })).error),
      ).toBe("42501");
      expect(
        errorCode(
          (await bob.client.rpc("express_seed_offer_interest", { p_offer_id: live })).error,
        ),
      ).toBe("P0002");
      expect(
        errorCode(
          (await dave.client.rpc("create_unidentified_source", { p_description: null })).error,
        ),
      ).toBe("42501");
      const hidden = await visitor.from("seed_offers").select("id").eq("id", live);
      expect(hidden.data ?? []).toEqual([]);
      expect(
        errorCode(
          (await dave.client.rpc("express_seed_offer_interest", { p_offer_id: live })).error,
        ),
      ).toBe("42501");
    } finally {
      await rows("update public.profiles set is_suspended = false where id = $1", [dave.id]);
    }
  });
});

describe("future resolution and concurrency", () => {
  it("a recorded unidentified parent can later be re-recorded as a cultivar without changing the offspring UUID, and the source record stays", async () => {
    const offspring = await publicSeedling(alice, "Resolution");
    const made = await unidentifiedWithPhoto(alice, `Resolution ${tag}`);
    await alice.client.rpc("set_seedling_parent_unidentified", {
      p_seedling_id: offspring,
      p_role: "seed_parent",
      p_source_id: made.source,
      p_notes: null,
    });
    const resolved = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: offspring,
      p_role: "seed_parent",
      p_kind: "cultivar",
      p_cultivar_name: `Resolved ${tag}`,
    });
    expect(resolved.error).toBeNull();
    const after = await rows("select id from public.seedlings where id = $1", [offspring]);
    expect(after).toHaveLength(1);
    const still = await rows(
      "select count(*)::int as n from public.unidentified_sources where id = $1",
      [made.source],
    );
    expect(still[0].n).toBe(1);
  });

  it("closing and a late interest race across connections: the late interest waits for the close, then is refused", async () => {
    const { data: source } = await alice.client.rpc("create_seed_source", {
      p_kind: "unknown_mixed",
    });
    const offer = (
      await alice.client.rpc("publish_seed_offer", {
        p_source_id: source,
        p_material_type: "seedheads",
        p_packet_size: null,
        p_seedhead_count: 2,
        p_mode: "free",
        p_price_text: null,
        p_handover_method: "pickup",
        p_note: null,
        p_items: [],
      })
    ).data as string;

    const closer = await connectAs(alice.id);
    const latecomer = await connectAs(carol.id);
    try {
      await closer.query("select close_seed_offer($1)", [offer]);
      const pending = latecomer.query("select express_seed_offer_interest($1, null)", [offer]).then(
        () => "accepted",
        (error: Error) => `refused: ${error.message}`,
      );
      const early = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve("still waiting"), 500)),
      ]);
      expect(early).toBe("still waiting");
      await closer.query("commit");
      expect(await pending).toMatch(/^refused/);
      await latecomer.query("rollback");
    } finally {
      await closer.end();
      await latecomer.end();
    }
    const interests = await rows(
      "select count(*)::int as n from public.seed_offer_interests where seed_offer_id = $1",
      [offer],
    );
    expect(interests[0].n).toBe(0);
  });
});

async function connectAs(userId: string) {
  const pg = (await import("pg")).default;
  const { localSupabase } = await import("../support/local-supabase");
  const db = new pg.Client({ connectionString: localSupabase().dbUrl });
  await db.connect();
  await db.query("begin");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await db.query("set local role authenticated");
  return db;
}

describe("parentage authority", () => {
  it("an unrelated grower cannot attach their own unidentified source to someone else's seedling, even with a valid photograph", async () => {
    const victim = await publicSeedling(alice, "Not yours");
    const own = await unidentifiedWithPhoto(bob, `Bob's own ${tag}`);
    const refused = await bob.client.rpc("set_seedling_parent_unidentified", {
      p_seedling_id: victim,
      p_role: "seed_parent",
      p_source_id: own.source,
      p_notes: null,
    });
    expect(refused.error).not.toBeNull();
    const rows2 = await rows(
      "select count(*)::int as n from public.seedling_parentage where child_seedling_id = $1",
      [victim],
    );
    expect(rows2[0].n).toBe(0);
  });
});
