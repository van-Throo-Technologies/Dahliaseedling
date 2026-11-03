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
 * A completed continuation's holder-transfer provenance event names the exact Rehome case that caused it. Earlier events
 * keep a null reference. The link is domain integrity: it does not widen what a visitor or unrelated grower can read.
 */

const created: string[] = [];
const visitor = anonClient();
const tag = "pv" + Math.random().toString(36).slice(2, 8);
let alice: TestUser; // originator
let bob: TestUser;
let carol: TestUser;
let dave: TestUser; // unrelated grower

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function offered(holder: TestUser, seedling: string): Promise<string> {
  const { data, error } = await holder.client.rpc("start_rehome", {
    p_seedling_id: seedling,
    p_term: "donate",
    p_handover: "pickup",
  });
  if (error) throw new Error(error.message);
  return data as string;
}

async function newSeedling(owner: TestUser, label: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_seedling", {
    p_working_name: `${label} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

/** One complete transfer from the holder to the recipient, returning the case that completed it. */
async function transfer(holder: TestUser, recipient: TestUser, seedling: string): Promise<string> {
  const caseId = await offered(holder, seedling);
  await recipient.client.rpc("express_rehome_interest", { p_case_id: caseId });
  await holder.client.rpc("choose_rehome_recipient", {
    p_case_id: caseId,
    p_recipient_id: recipient.id,
  });
  const confirmed = await recipient.client.rpc("confirm_rehome_received", { p_case_id: caseId });
  if (confirmed.data !== "completed")
    throw new Error(`transfer did not complete: ${confirmed.data}`);
  return caseId;
}

beforeAll(async () => {
  alice = await createTestUser("pv-alice");
  bob = await createTestUser("pv-bob");
  carol = await createTestUser("pv-carol");
  dave = await createTestUser("pv-dave");
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
  await removeTestUsers(created);
});

describe("a holder transfer names the case that caused it", () => {
  it("A to B: the transfer event references the completed case, and no other case", async () => {
    const seedling = await newSeedling(alice, "AB");
    const caseId = await transfer(alice, bob, seedling);
    const events = await rows(
      "select event_type, rehome_case_id, from_holder_id, to_holder_id from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(events).toEqual([
      {
        event_type: "continuation_received",
        rehome_case_id: caseId,
        from_holder_id: alice.id,
        to_holder_id: bob.id,
      },
    ]);
    const origin = await rows(
      "select event_type, rehome_case_id from public.provenance_events where seedling_id = $1 and event_type = 'originated'",
      [seedling],
    );
    expect(origin).toEqual([{ event_type: "originated", rehome_case_id: null }]);
  });

  it("double confirmation: one holder transfer, one transfer event, one case reference", async () => {
    const seedling = await newSeedling(alice, "Twice");
    const caseId = await offered(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    const first = await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    const second = await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    expect(first.data).toBe("completed");
    expect(second.data).toBe("already_completed");
    const events = await rows(
      "select rehome_case_id from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(events).toEqual([{ rehome_case_id: caseId }]);
  });

  it("A to B to C to A: three cases, three transfer events, each event naming its own case; same UUID; originator fixed", async () => {
    const seedling = await newSeedling(alice, "Chain");
    const originBefore = (
      await rows("select originator_id from public.seedlings where id = $1", [seedling])
    )[0];

    const case1 = await transfer(alice, bob, seedling);
    const case2 = await transfer(bob, carol, seedling);
    const case3 = await transfer(carol, alice, seedling);

    const events = await rows(
      "select rehome_case_id, from_holder_id, to_holder_id from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received' order by occurred_at, id",
      [seedling],
    );
    expect(events).toEqual([
      { rehome_case_id: case1, from_holder_id: alice.id, to_holder_id: bob.id },
      { rehome_case_id: case2, from_holder_id: bob.id, to_holder_id: carol.id },
      { rehome_case_id: case3, from_holder_id: carol.id, to_holder_id: alice.id },
    ]);
    expect(new Set([case1, case2, case3]).size).toBe(3);

    const count = await rows("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(count[0].n).toBe(1);
    const originAfter = (
      await rows("select originator_id from public.seedlings where id = $1", [seedling])
    )[0];
    expect(originAfter).toEqual(originBefore);
    expect(originAfter.originator_id).toBe(alice.id);
  });
});

describe("cases that do not complete never create a transfer event", () => {
  it("started, interested, chosen, declined, reopened, cancelled and sent cases leave no transfer event and no case reference", async () => {
    const seedling = await newSeedling(alice, "Open");
    const caseId = await offered(alice, seedling);
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("decline_rehome", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: carol.id,
    });
    await alice.client.rpc("mark_rehome_sent", { p_case_id: caseId });
    await alice.client.rpc("reopen_rehome", { p_case_id: caseId });
    await alice.client.rpc("cancel_rehome", { p_case_id: caseId });

    const status = await rows("select status from public.rehome_cases where id = $1", [caseId]);
    expect(status[0].status).toBe("cancelled");
    const transfers = await rows(
      "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(transfers[0].n).toBe(0);
    const linked = await rows(
      "select count(*)::int as n from public.provenance_events where rehome_case_id = $1",
      [caseId],
    );
    expect(linked[0].n).toBe(0);
  });
});

describe("the integrity of the link is enforced by the database", () => {
  it("a transfer event must name a case, and an origin event must not", async () => {
    const seedling = await newSeedling(alice, "Constraint");
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.provenance_events (seedling_id, event_type, from_holder_id, to_holder_id) values ($1, 'continuation_received', $2, $3)",
          [seedling, alice.id, bob.id],
        ),
      ),
    ).rejects.toThrow(/provenance_rehome_case_matches_event/);

    const caseId = await transfer(alice, bob, seedling);
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.provenance_events (seedling_id, event_type, rehome_case_id) values ($1, 'originated', $2)",
          [seedling, caseId],
        ),
      ),
    ).rejects.toThrow(/provenance_rehome_case_matches_event/);
  });

  it("a link to a case that does not exist is refused", async () => {
    const seedling = await newSeedling(alice, "Dangling");
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.provenance_events (seedling_id, event_type, from_holder_id, to_holder_id, rehome_case_id) values ($1, 'continuation_received', $2, $3, $4)",
          [seedling, alice.id, bob.id, crypto.randomUUID()],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("only one transfer event can name a given case", async () => {
    const seedling = await newSeedling(alice, "Unique");
    const caseId = await transfer(alice, bob, seedling);
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.provenance_events (seedling_id, event_type, from_holder_id, to_holder_id, rehome_case_id) values ($1, 'continuation_received', $2, $3, $4)",
          [seedling, alice.id, carol.id, caseId],
        ),
      ),
    ).rejects.toThrow(/provenance_one_transfer_per_case/);
  });
});

describe("the link does not widen what a reader can see", () => {
  it("a visitor and an authenticated unrelated grower cannot read the link column, and cannot read the case through it", async () => {
    const seedling = await newSeedling(alice, "Privacy");
    const caseId = await transfer(alice, bob, seedling);

    const anonLink = await visitor
      .from("provenance_events")
      .select("rehome_case_id")
      .eq("seedling_id", seedling);
    expect(errorCode(anonLink.error)).toBe("42501");
    const daveLink = await dave.client
      .from("provenance_events")
      .select("rehome_case_id")
      .eq("seedling_id", seedling);
    expect(errorCode(daveLink.error)).toBe("42501");

    const anonHistory = await visitor
      .from("provenance_events")
      .select("event_type, occurred_at, to_holder_id")
      .eq("seedling_id", seedling)
      .order("occurred_at", { ascending: true });
    expect(anonHistory.error).toBeNull();
    expect(anonHistory.data!.map((r) => r.event_type)).toEqual([
      "originated",
      "continuation_received",
    ]);

    const daveCase = await dave.client.from("rehome_cases").select("id").eq("id", caseId);
    expect(daveCase.data ?? []).toEqual([]);
    const visitorCase = await visitor.from("rehome_cases").select("id").eq("id", caseId);
    expect(visitorCase.data ?? []).toEqual([]);
  });

  it("the visible history and the case's own readers are unchanged: the transfer party still sees its case, a stranger does not", async () => {
    const seedling = await newSeedling(alice, "Parties");
    const caseId = await transfer(alice, bob, seedling);
    const bobCase = await bob.client.from("rehome_cases").select("id").eq("id", caseId);
    expect(bobCase.data).toHaveLength(1);
    const aliceCase = await alice.client.from("rehome_cases").select("id").eq("id", caseId);
    expect(aliceCase.data).toHaveLength(1);
    const daveCase = await dave.client.from("rehome_cases").select("id").eq("id", caseId);
    expect(daveCase.data ?? []).toEqual([]);
  });
});
