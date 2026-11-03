import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import {
  capturePhoto,
  publishPublicImage,
  type CapturedPhoto,
  type PublishedImage,
} from "../support/public-update";

/*
 * The positive Seedling-source path. The Seedling gets its public image through the real Capture and Public Update path
 * (Phase 3 and Phase 4), then a seed offer is published from that exact Seedling. Seed material never moves the parent:
 * its holder, its originator and its UUID stay the same, no continuation is recorded, and no offspring Seedling appears.
 */

const visitor = anonClient();
const tag = "ps" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser; // holder and originator of the source Seedling
let bob: TestUser; // a grower who is not the holder

let seedling = "";
let photo: CapturedPhoto;
let image: PublishedImage;
let offer = "";
let before: { holder: string; originator: string; transfers: number };

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

beforeAll(async () => {
  alice = await createTestUser("ps-alice");
  bob = await createTestUser("ps-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });

  const { data, error } = await alice.client.rpc("create_seedling", {
    p_working_name: `Source ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  seedling = data!.id as string;

  photo = await capturePhoto(alice, seedling);
  image = await publishPublicImage(alice, photo);
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the public Seedling image, from the real capture and publication path", () => {
  it("the Seedling now has a live public derivative that the Phase 7 rule expects", async () => {
    const derivative = await rows(
      "select id, source_media_id from public.public_derivatives where storage_path = $1",
      [image.derivativePath],
    );
    expect(derivative).toHaveLength(1);
    expect(derivative[0].source_media_id).toBe(photo.mediaId);
    const live = await visitor
      .from("public_derivatives")
      .select("id")
      .eq("storage_path", image.derivativePath);
    expect(live.data).toHaveLength(1);
  });
});

describe("publishing a seed offer from the Seedling", () => {
  it("is refused to a grower who is not the current holder, and creates nothing", async () => {
    const refused = await bob.client.rpc("create_seed_source", {
      p_kind: "seedling",
      p_seedling_id: seedling,
    });
    expect(errorCode(refused.error)).toBe("P0002");
    const sources = await rows(
      "select count(*)::int as n from public.seed_sources where source_seedling_id = $1",
      [seedling],
    );
    expect(sources[0].n).toBe(0);
  });

  it("succeeds for the holder, reuses the existing public derivative, and leaves the Seedling untouched", async () => {
    const seedlingRow = await rows(
      "select current_holder_id, originator_id from public.seedlings where id = $1",
      [seedling],
    );
    before = {
      holder: seedlingRow[0].current_holder_id as string,
      originator: seedlingRow[0].originator_id as string,
      transfers: (
        await rows(
          "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
          [seedling],
        )
      )[0].n,
    };
    const derivativesBefore = (
      await rows(
        "select count(*)::int as n from public.public_derivatives where source_media_id = $1",
        [photo.mediaId],
      )
    )[0].n;

    const { data: source, error: sourceError } = await alice.client.rpc("create_seed_source", {
      p_kind: "seedling",
      p_seedling_id: seedling,
    });
    expect(sourceError).toBeNull();
    const { data, error } = await alice.client.rpc("publish_seed_offer", {
      p_source_id: source as string,
      p_material_type: "seedheads",
      p_seedhead_count: 3,
      p_mode: "free",
      p_handover_method: "pickup",
      p_items: [],
    });
    expect(error).toBeNull();
    offer = data as string;

    // The offer points at the Seedling's existing derivative. No new derivative is made for it.
    const links = await rows(
      "select m.role, d.storage_path from public.seed_offer_media m join public.public_derivatives d on d.id = m.derivative_id where m.offer_id = $1",
      [offer],
    );
    expect(links).toEqual([{ role: "parent_image", storage_path: image.derivativePath }]);
    const derivativesAfter = (
      await rows(
        "select count(*)::int as n from public.public_derivatives where source_media_id = $1",
        [photo.mediaId],
      )
    )[0].n;
    expect(derivativesAfter).toBe(derivativesBefore);
  });

  it("the parent Seedling keeps its UUID, holder and originator; no continuation and no offspring Seedling appear", async () => {
    const after = await rows(
      "select current_holder_id, originator_id from public.seedlings where id = $1",
      [seedling],
    );
    expect(after[0].current_holder_id).toBe(before.holder);
    expect(after[0].originator_id).toBe(before.originator);
    const count = await rows("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(count[0].n).toBe(1);
    const transfers = await rows(
      "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(transfers[0].n).toBe(before.transfers);
  });
});

describe("visibility, media privacy and Search for the Seedling-sourced offer", () => {
  it("a visitor receives the public derivative, never the private original", async () => {
    const shown = await visitor.storage.from("public-media").download(image.derivativePath);
    expect(shown.error).toBeNull();
    const original = await visitor.storage.from("private-media").download(photo.originalPath);
    expect(original.error).not.toBeNull();
    const signed = await visitor.storage
      .from("private-media")
      .createSignedUrl(photo.originalPath, 60);
    expect(signed.data?.signedUrl).toBeUndefined();
    const media = await visitor.from("media").select("id").eq("id", photo.mediaId);
    expect(media.data ?? []).toEqual([]);
  });

  it("the offer is found by a visitor through Search, with the correct Seedling, material and public image only", async () => {
    const { data, error } = await visitor.rpc("search_seed_offers", {
      p_query: `Source ${tag}`,
      p_limit: 20,
    });
    expect(error).toBeNull();
    const hits = (data ?? []) as {
      offer_id: string;
      source_kind: string;
      source_seedling_id: string;
      source_seedling_name: string;
      material_type: string;
      photo_path: string;
    }[];
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      offer_id: offer,
      source_kind: "seedling",
      source_seedling_id: seedling,
      source_seedling_name: `Source ${tag}`,
      material_type: "seedheads",
      photo_path: image.derivativePath,
    });
    expect(JSON.stringify(hits[0])).not.toContain(photo.originalPath);
  });

  it("the Seedling's own offer does not expose anything to the seed parent's other growers", async () => {
    const others = await bob.client
      .from("seed_offer_interests")
      .select("id")
      .eq("seed_offer_id", offer);
    expect(others.data ?? []).toEqual([]);
    const sellerRows = await rows(
      "select count(*)::int as n from public.seed_offers where id = $1 and seller_id = $2",
      [offer, alice.id],
    );
    expect(sellerRows[0].n).toBe(1);
  });
});
