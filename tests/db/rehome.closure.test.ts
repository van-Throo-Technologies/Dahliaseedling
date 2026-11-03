import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  anonClient,
  createTestUser,
  localSupabase,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Phase 6 closure. These tests cover the boundaries that the earlier suite only sampled: historical private
 * Observations and their media after a real transfer, old and new holder authority through the functions the app
 * calls, races on two separate database connections, pending-recipient privacy, suspension, and the lifetime chain
 * A to B to C back to A. Each test uses the real role and session, not a shortcut around the boundary.
 */

const created: string[] = [];
const visitor = anonClient();
const tag = "cl" + Math.random().toString(36).slice(2, 8);
const MARKER = `PRIVATE-MARKER-${tag}`;
let alice: TestUser; // originator, first holder
let bob: TestUser; // interested grower, then holder
let carol: TestUser; // interested grower, then holder
let dave: TestUser; // suspended in one test

function bytes(size: number): Blob {
  const data = new Uint8Array(size);
  data.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([data], { type: "image/jpeg" });
}

async function uploadAs(user: TestUser): Promise<string> {
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await user.client.storage
    .from("private-media")
    .upload(path, bytes(2048), { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`upload setup failed: ${error.message}`);
  return path;
}

/** A real capture: the photo is uploaded into the caller's own folder, then registered with the Observation. */
async function captureWith(user: TestUser, seedling: string, note: string) {
  const path = await uploadAs(user);
  return user.client.rpc("capture_observation", {
    p_seedling_id: seedling,
    p_note: note,
    p_paths: [path],
  });
}

async function publicSeedling(owner: TestUser, label: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_seedling", {
    p_working_name: `${label} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id;
}

async function startAvailable(holder: TestUser, seedling: string): Promise<string> {
  const { data, error } = await holder.client.rpc("start_rehome", {
    p_seedling_id: seedling,
    p_term: "donate",
    p_handover: "pickup",
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Opens a separate connection acting as one signed-in user, inside a transaction the caller ends. */
async function connectAs(userId: string): Promise<pg.Client> {
  const db = new pg.Client({ connectionString: localSupabase().dbUrl });
  await db.connect();
  await db.query("begin");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await db.query("set local role authenticated");
  return db;
}

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function holderOf(seedling: string): Promise<string> {
  const found = await rows("select current_holder_id from public.seedlings where id = $1", [
    seedling,
  ]);
  return found[0].current_holder_id as string;
}

async function transferProvenance(seedling: string) {
  return rows(
    "select from_holder_id, to_holder_id from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received' order by occurred_at, id",
    [seedling],
  );
}

async function accessToken(user: TestUser): Promise<string> {
  const session = await user.client.auth.getSession();
  return session.data.session!.access_token;
}

beforeAll(async () => {
  alice = await createTestUser("cl-alice");
  bob = await createTestUser("cl-bob");
  carol = await createTestUser("cl-carol");
  dave = await createTestUser("cl-dave");
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

describe("historical private Observations and media after a real transfer", () => {
  let seedling: string;
  let observationId: string;
  let mediaPath: string;

  beforeAll(async () => {
    seedling = await publicSeedling(alice, "History");
    const path = await uploadAs(alice);
    // The real capture path: a photo in the holder's own folder, registered with the Observation, and a private note.
    const { data, error } = await alice.client.rpc("capture_observation", {
      p_seedling_id: seedling,
      p_note: `Private note ${MARKER}`,
      p_paths: [path],
    });
    if (error) throw new Error(error.message);
    observationId = (data as { id: string }).id;
    const stored = await rows(
      "select m.storage_path from public.observation_media om join public.media m on m.id = om.media_id where om.observation_id = $1",
      [observationId],
    );
    mediaPath = stored[0].storage_path as string;
  });

  it("A, the holder when it was made, keeps legitimate access to the Observation and its original", async () => {
    const own = await alice.client.from("observations").select("id").eq("id", observationId);
    expect(own.data).toHaveLength(1);
    const download = await alice.client.storage.from("private-media").download(mediaPath);
    expect(download.error).toBeNull();
  });

  it("completes A to B, and B then cannot read the Observation, its note, its media row, or its original", async () => {
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });
    const confirmed = await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });
    expect(confirmed.data).toBe("completed");
    expect(await holderOf(seedling)).toBe(bob.id);

    const observation = await bob.client
      .from("observations")
      .select("id, note")
      .eq("id", observationId);
    expect(observation.data ?? []).toEqual([]);
    const byMarker = await bob.client
      .from("observations")
      .select("id")
      .ilike("note", `%${MARKER}%`);
    expect(byMarker.data ?? []).toEqual([]);
    const links = await bob.client
      .from("observation_media")
      .select("media_id")
      .eq("observation_id", observationId);
    expect(links.data ?? []).toEqual([]);
    const mediaRows = await bob.client.from("media").select("id").eq("storage_path", mediaPath);
    expect(mediaRows.data ?? []).toEqual([]);

    const download = await bob.client.storage.from("private-media").download(mediaPath);
    expect(download.error).not.toBeNull();
    const signed = await bob.client.storage.from("private-media").createSignedUrl(mediaPath, 60);
    expect(signed.data?.signedUrl).toBeUndefined();
  });

  it("a direct object URL with B's session, and a visitor's, do not return the original", async () => {
    const { apiUrl, publishableKey } = localSupabase();
    const url = `${apiUrl}/storage/v1/object/private-media/${mediaPath}`;
    const withB = await fetch(url, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${await accessToken(bob)}` },
    });
    expect(withB.status).not.toBe(200);
    const anonymous = await fetch(url, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
    expect(anonymous.status).not.toBe(200);
  });

  it("no public route reveals the marker: visitor Search, the visitor's panel and the visitor's Observation read", async () => {
    const search = await visitor.rpc("search_seedlings", {
      p_query: MARKER,
      p_country: null,
      p_limit: 12,
    });
    expect(search.data ?? []).toEqual([]);
    const observations = await visitor.from("observations").select("id").eq("id", observationId);
    expect(observations.data ?? []).toEqual([]);
    const panel = await visitor.rpc("rehome_panel", { p_seedling_id: seedling });
    expect(JSON.stringify(panel.data)).not.toContain(MARKER);
  });

  it("B, the new holder, documents the Seedling going forward; A's history stays A's", async () => {
    const { data, error } = await captureWith(bob, seedling, `New holder note ${tag}`);
    expect(error).toBeNull();
    expect((data as { seedling_id: string }).seedling_id).toBe(seedling);
    const aStill = await alice.client.from("observations").select("id").eq("id", observationId);
    expect(aStill.data).toHaveLength(1);
    const bNew = await bob.client
      .from("observations")
      .select("id")
      .eq("id", (data as { id: string }).id);
    expect(bNew.data).toHaveLength(1);
    const bOld = await bob.client.from("observations").select("id").eq("id", observationId);
    expect(bOld.data ?? []).toEqual([]);
  });
});

describe("old and new holder authority, through the functions the app calls", () => {
  it("after A to B, A cannot capture, re-parent, attach a series, or start a continuation; the state does not change", async () => {
    const seedling = await publicSeedling(alice, "Old authority");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });

    const capture = await captureWith(alice, seedling, "A after transfer");
    expect(capture.error).not.toBeNull();

    const parent = await alice.client.rpc("set_seedling_parent", {
      p_seedling_id: seedling,
      p_role: "seed_parent",
      p_kind: "unknown",
    });
    expect(parent.error).not.toBeNull();

    const series = await alice.client.rpc("create_series", {
      p_name: `S${tag.slice(2, 8)}`,
      p_include_year: false,
    });
    expect(series.error).toBeNull();
    const attach = await alice.client.rpc("attach_series_identifier", {
      p_seedling_id: seedling,
      p_series_id: series.data!.id,
    });
    expect(attach.error).not.toBeNull();

    const restart = await alice.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "donate",
    });
    expect(restart.error).not.toBeNull();

    expect(await holderOf(seedling)).toBe(bob.id);
    const parentage = await rows(
      "select count(*)::int as n from public.seedling_parentage where child_seedling_id = $1",
      [seedling],
    );
    expect(parentage[0].n).toBe(0);
  });

  it("after the same transfer, B has the same UUID, can capture and re-parent, and can start the next continuation", async () => {
    const seedling = await publicSeedling(alice, "New authority");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });

    const capture = await captureWith(bob, seedling, "B documents");
    expect(capture.error).toBeNull();
    const parent = await bob.client.rpc("set_seedling_parent", {
      p_seedling_id: seedling,
      p_role: "seed_parent",
      p_kind: "unknown",
    });
    expect(parent.error).toBeNull();
    const next = await bob.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "donate",
    });
    expect(next.error).toBeNull();

    const uuids = await rows("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(uuids[0].n).toBe(1);
  });
});

describe("the transfer boundary, step by step", () => {
  it("the holder and the provenance stay put until the recipient confirms; then both change exactly once", async () => {
    const seedling = await publicSeedling(alice, "Boundary");
    const offer = await startAvailable(alice, seedling);
    const steps: { holder: string; events: number }[] = [];
    const snapshot = async () =>
      steps.push({
        holder: await holderOf(seedling),
        events: (await transferProvenance(seedling)).length,
      });

    await snapshot(); // available
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await snapshot(); // B has expressed interest
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });
    await snapshot(); // A has selected B
    await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });
    await snapshot(); // B has confirmed receipt

    expect(steps).toEqual([
      { holder: alice.id, events: 0 },
      { holder: alice.id, events: 0 },
      { holder: alice.id, events: 0 },
      { holder: bob.id, events: 1 },
    ]);
    const events = await transferProvenance(seedling);
    expect(events).toEqual([{ from_holder_id: alice.id, to_holder_id: bob.id }]);
  });
});

describe("races on separate database connections", () => {
  it("two selections racing across connections: the second waits for the first, then is refused; one recipient", async () => {
    const seedling = await publicSeedling(alice, "Race select");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await carol.client.rpc("express_rehome_interest", { p_case_id: offer });

    const first = await connectAs(alice.id);
    const second = await connectAs(alice.id);
    try {
      await first.query("select choose_rehome_recipient($1, $2)", [offer, bob.id]);
      const pending = second
        .query("select choose_rehome_recipient($1, $2)", [offer, carol.id])
        .then(
          () => "accepted",
          (error: Error) => `refused: ${error.message}`,
        );
      const early = await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve("still waiting"), 500)),
      ]);
      expect(early).toBe("still waiting");
      await first.query("commit");
      const outcome = await pending;
      expect(outcome).toMatch(/^refused/);
      await second.query("rollback");
    } finally {
      await first.end();
      await second.end();
    }

    const chosen = await rows(
      "select count(*) filter (where chosen_recipient_id is not null)::int as n, min(chosen_recipient_id::text) as who from public.rehome_cases where id = $1",
      [offer],
    );
    expect(chosen[0].n).toBe(1);
    expect(chosen[0].who).toBe(bob.id);
  });

  it("two confirmations racing across connections: one transfer, one provenance event, the second reports completion already happened", async () => {
    const seedling = await publicSeedling(alice, "Race confirm");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });

    const first = await connectAs(bob.id);
    const second = await connectAs(bob.id);
    let outcome: unknown;
    try {
      const firstResult = await first.query("select confirm_rehome_received($1) as r", [offer]);
      const pending = second.query("select confirm_rehome_received($1) as r", [offer]).then(
        (result) => result.rows[0].r,
        (error: Error) => `refused: ${error.message}`,
      );
      await first.query("commit");
      outcome = await pending;
      expect(firstResult.rows[0].r).toBe("completed");
      await second.query("commit");
    } finally {
      await first.end();
      await second.end();
    }

    expect(outcome).toBe("already_completed");
    expect(await holderOf(seedling)).toBe(bob.id);
    expect(await transferProvenance(seedling)).toEqual([
      { from_holder_id: alice.id, to_holder_id: bob.id },
    ]);
  });
});

describe("pending recipient privacy", () => {
  it("while B is selected and not yet confirmed: the visitor, an unrelated grower and an interested non-selected grower cannot learn B", async () => {
    const seedling = await publicSeedling(alice, "Pending");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await carol.client.rpc("express_rehome_interest", { p_case_id: offer });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });

    const visitorPanel = await visitor.rpc("rehome_panel", { p_seedling_id: seedling });
    expect(JSON.stringify(visitorPanel.data)).not.toContain(bob.id);
    const visitorRows = await visitor
      .from("rehome_cases")
      .select("chosen_recipient_id")
      .eq("id", offer);
    expect(visitorRows.data ?? []).toEqual([]);

    const carolPanel = await carol.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect(JSON.stringify(carolPanel.data)).not.toContain(bob.id);
    const carolRows = await carol.client
      .from("rehome_cases")
      .select("chosen_recipient_id")
      .eq("id", offer);
    expect(carolRows.data ?? []).toEqual([]);

    const bobPanel = await bob.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect((bobPanel.data as { role: string }).role).toBe("recipient");
    expect((bobPanel.data as { case: { chosenRecipientId: string } }).case.chosenRecipientId).toBe(
      bob.id,
    );

    const alicePanel = await alice.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect(
      (alicePanel.data as { case: { chosenRecipientId: string } }).case.chosenRecipientId,
    ).toBe(bob.id);
  });
});

describe("suspension", () => {
  async function suspend(user: TestUser, value: boolean) {
    await rows("update public.profiles set is_suspended = $2 where id = $1", [user.id, value]);
  }

  it("a suspended holder cannot start availability, and a suspended grower cannot express interest", async () => {
    const seedling = await publicSeedling(dave, "Suspended holder");
    await suspend(dave, true);
    try {
      expect(
        (await dave.client.rpc("start_rehome", { p_seedling_id: seedling, p_term: "donate" }))
          .error,
      ).not.toBeNull();
    } finally {
      await suspend(dave, false);
    }

    const offer = await startAvailable(alice, await publicSeedling(alice, "Suspended grower"));
    await suspend(carol, true);
    try {
      expect(
        (await carol.client.rpc("express_rehome_interest", { p_case_id: offer })).error,
      ).not.toBeNull();
    } finally {
      await suspend(carol, false);
    }
  });

  it("a suspended holder cannot select a recipient; a suspended recipient cannot confirm; the pending case is kept, not deleted", async () => {
    const seedling = await publicSeedling(alice, "Suspended pending");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });

    await suspend(alice, true);
    try {
      expect(
        (
          await alice.client.rpc("choose_rehome_recipient", {
            p_case_id: offer,
            p_recipient_id: bob.id,
          })
        ).error,
      ).not.toBeNull();
    } finally {
      await suspend(alice, false);
    }

    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });
    await suspend(bob, true);
    try {
      const refused = await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });
      expect(refused.error).not.toBeNull();
    } finally {
      await suspend(bob, false);
    }

    expect(await holderOf(seedling)).toBe(alice.id);
    const kept = await rows("select status from public.rehome_cases where id = $1", [offer]);
    expect(kept[0].status).toBe("arranged");
    const later = await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });
    expect(later.data).toBe("completed");
  });
});

describe("closing a finished transfer", () => {
  it("a completed transfer cannot be cancelled as if it were pending, and the holder does not change", async () => {
    const seedling = await publicSeedling(alice, "Closed");
    const offer = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: offer });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: offer, p_recipient_id: bob.id });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: offer });

    // Refused either as not the offering grower or as already closed; the function checks authority first.
    const cancel = await bob.client.rpc("cancel_rehome", { p_case_id: offer });
    expect(cancel.error).not.toBeNull();
    const reopen = await alice.client.rpc("reopen_rehome", { p_case_id: offer });
    expect(reopen.error).not.toBeNull();
    expect(await holderOf(seedling)).toBe(bob.id);
    const status = await rows("select status from public.rehome_cases where id = $1", [offer]);
    expect(status[0].status).toBe("completed");
  });
});

describe("lifetime chain A to B to C to A", () => {
  it("holders progress A, B, C, A on one UUID; the originator stays A; provenance records each transfer in order; no self-transfer", async () => {
    const seedling = await publicSeedling(alice, "Chain");
    const originBefore = await rows("select originator_id from public.seedlings where id = $1", [
      seedling,
    ]);
    const holders: string[] = [await holderOf(seedling)];

    // A to B
    const first = await startAvailable(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: first });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: first, p_recipient_id: bob.id });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: first });
    holders.push(await holderOf(seedling));

    // B to C
    const second = await startAvailable(bob, seedling);
    await carol.client.rpc("express_rehome_interest", { p_case_id: second });
    await bob.client.rpc("choose_rehome_recipient", {
      p_case_id: second,
      p_recipient_id: carol.id,
    });
    await carol.client.rpc("confirm_rehome_received", { p_case_id: second });
    holders.push(await holderOf(seedling));

    // C back to A, the originator, who becomes a legitimate non-holder recipient at that point
    const third = await startAvailable(carol, seedling);
    const selfChoice = await carol.client.rpc("choose_rehome_recipient", {
      p_case_id: third,
      p_recipient_id: carol.id,
    });
    expect(selfChoice.error).not.toBeNull();
    await alice.client.rpc("express_rehome_interest", { p_case_id: third });
    await carol.client.rpc("choose_rehome_recipient", {
      p_case_id: third,
      p_recipient_id: alice.id,
    });
    await alice.client.rpc("confirm_rehome_received", { p_case_id: third });
    holders.push(await holderOf(seedling));

    expect(holders).toEqual([alice.id, bob.id, carol.id, alice.id]);
    const originAfter = await rows("select originator_id from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(originAfter).toEqual(originBefore);
    expect(originAfter[0].originator_id).toBe(alice.id);
    const events = await transferProvenance(seedling);
    expect(events).toEqual([
      { from_holder_id: alice.id, to_holder_id: bob.id },
      { from_holder_id: bob.id, to_holder_id: carol.id },
      { from_holder_id: carol.id, to_holder_id: alice.id },
    ]);
    const count = await rows("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(count[0].n).toBe(1);
  });
});
