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
 * Phase 6 decisions. The holder's selection list shows active interests only, and withdrawn records stay stored. A
 * selected recipient may decline an arrangement that is still arranged (not sent, never after receipt): the case returns
 * to available, the holder and the provenance do not change, and the Seedling keeps its identity.
 */

const created: string[] = [];
const visitor = anonClient();
const tag = "dc" + Math.random().toString(36).slice(2, 8);
let alice: TestUser; // holder and originator
let bob: TestUser; // interested, then chosen
let carol: TestUser; // interested
let dave: TestUser; // unrelated grower, suspended in one test

async function scalar(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function holderOf(seedling: string): Promise<string> {
  const rows = await scalar("select current_holder_id from public.seedlings where id = $1", [
    seedling,
  ]);
  return rows[0].current_holder_id as string;
}

async function suspend(user: TestUser, value: boolean) {
  await scalar("update public.profiles set is_suspended = $2 where id = $1", [user.id, value]);
}

/** A public Seedling of alice with an available case. */
async function offered(label: string): Promise<{ seedling: string; caseId: string }> {
  const { data, error } = await alice.client.rpc("create_seedling", {
    p_working_name: `${label} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  const seedling = data!.id as string;
  const started = await alice.client.rpc("start_rehome", {
    p_seedling_id: seedling,
    p_term: "donate",
    p_handover: "pickup",
  });
  if (started.error) throw new Error(started.error.message);
  return { seedling, caseId: started.data as string };
}

beforeAll(async () => {
  alice = await createTestUser("dc-alice");
  bob = await createTestUser("dc-bob");
  carol = await createTestUser("dc-carol");
  dave = await createTestUser("dc-dave");
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
  await scalar("update public.profiles set is_suspended = false where id = any($1::uuid[])", [
    created,
  ]);
  await removeTestUsers(created);
});

describe("the holder's selection list shows active interests only", () => {
  it("a withdrawn interest leaves the holder's list and cannot be chosen, but its record stays stored", async () => {
    const { seedling, caseId } = await offered("Active list");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    expect(
      (await bob.client.rpc("withdraw_rehome_interest", { p_case_id: caseId })).error,
    ).toBeNull();

    const holderPanel = await alice.client.rpc("rehome_panel", { p_seedling_id: seedling });
    const listed = (holderPanel.data as { interests: { userId: string; active: boolean }[] })
      .interests;
    expect(listed.map((i) => i.userId)).toEqual([carol.id]);
    expect(listed.every((i) => i.active)).toBe(true);

    const refused = await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    expect(refused.error).not.toBeNull();

    const stored = await scalar(
      "select count(*)::int as n from public.rehome_interests where rehome_case_id = $1 and interested_user_id = $2 and withdrawn_at is not null",
      [caseId, bob.id],
    );
    expect(stored[0].n).toBe(1);
  });

  it("interested growers still see only their own state; the withdrawn grower sees their own record and nothing else", async () => {
    const { seedling, caseId } = await offered("Privacy list");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await bob.client.rpc("withdraw_rehome_interest", { p_case_id: caseId });

    const carolPanel = await carol.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect((carolPanel.data as { role: string }).role).toBe("interested");
    expect((carolPanel.data as { interests: unknown[] }).interests).toEqual([]);
    expect(JSON.stringify(carolPanel.data)).not.toContain(bob.id);

    const bobPanel = await bob.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect((bobPanel.data as { role: string }).role).toBe("member");
    expect((bobPanel.data as { interests: unknown[] }).interests).toEqual([]);

    const bobOwn = await bob.client
      .from("rehome_interests")
      .select("interested_user_id, withdrawn_at")
      .eq("rehome_case_id", caseId);
    expect(bobOwn.data).toHaveLength(1);
    expect(bobOwn.data?.[0]?.withdrawn_at).not.toBeNull();
    const carolSees = await carol.client
      .from("rehome_interests")
      .select("interested_user_id")
      .eq("rehome_case_id", caseId);
    expect(carolSees.data!.map((r) => r.interested_user_id)).toEqual([carol.id]);
  });
});

describe("a selected recipient may decline an arranged continuation", () => {
  it("the selected recipient declines: available again, no recipient, holder unchanged, no provenance, identity kept", async () => {
    const { seedling, caseId } = await offered("Decline");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });

    const declined = await bob.client.rpc("decline_rehome", { p_case_id: caseId });
    expect(declined.error).toBeNull();
    expect(declined.data).toBe("declined");

    const row = await scalar(
      "select status, chosen_recipient_id, sent_at from public.rehome_cases where id = $1",
      [caseId],
    );
    expect(row[0]).toEqual({ status: "available", chosen_recipient_id: null, sent_at: null });
    expect(await holderOf(seedling)).toBe(alice.id);
    const provenance = await scalar(
      "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(provenance[0].n).toBe(0);
    const count = await scalar("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(count[0].n).toBe(1);
  });

  it("after a decline the Seedling is available in Search again, and the holder can choose again", async () => {
    const { seedling, caseId } = await offered("Decline search");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("decline_rehome", { p_case_id: caseId });

    const hits = await visitor.rpc("search_seedlings", {
      p_query: `Decline search ${tag}`,
      p_country: null,
      p_limit: 12,
      p_available: true,
    });
    expect((hits.data as { seedling_id: string }[]).map((h) => h.seedling_id)).toContain(seedling);

    const chosen = await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: carol.id,
    });
    expect(chosen.error).toBeNull();
    const confirmed = await carol.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    expect(confirmed.data).toBe("completed");
    expect(await holderOf(seedling)).toBe(carol.id);
    const count = await scalar("select count(*)::int as n from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(count[0].n).toBe(1);
  });

  it("the decliner may express interest again, and is then selectable again", async () => {
    const { caseId } = await offered("Re-engage");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("decline_rehome", { p_case_id: caseId });

    const again = await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    expect(again.error).toBeNull();
    const chosen = await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    expect(chosen.error).toBeNull();
  });

  it("refuses the holder, an unrelated grower, and a grower who was interested but not selected", async () => {
    const { seedling, caseId } = await offered("Refusals");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });

    expect(errorCode((await alice.client.rpc("decline_rehome", { p_case_id: caseId })).error)).toBe(
      "42501",
    );
    expect(errorCode((await dave.client.rpc("decline_rehome", { p_case_id: caseId })).error)).toBe(
      "42501",
    );
    expect(errorCode((await carol.client.rpc("decline_rehome", { p_case_id: caseId })).error)).toBe(
      "42501",
    );

    const status = await scalar(
      "select status, chosen_recipient_id from public.rehome_cases where id = $1",
      [caseId],
    );
    expect(status[0]).toEqual({ status: "arranged", chosen_recipient_id: bob.id });
    expect(await holderOf(seedling)).toBe(alice.id);
  });

  it("a suspended recipient cannot decline; the arrangement stays for a later decision", async () => {
    const { caseId } = await offered("Suspended decline");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });

    await suspend(bob, true);
    try {
      expect(errorCode((await bob.client.rpc("decline_rehome", { p_case_id: caseId })).error)).toBe(
        "42501",
      );
    } finally {
      await suspend(bob, false);
    }
    const status = await scalar("select status from public.rehome_cases where id = $1", [caseId]);
    expect(status[0].status).toBe("arranged");
  });

  it("a sent arrangement cannot be declined, and a completed transfer cannot be declined", async () => {
    const sentCase = (await offered("Sent decline")).caseId;
    await bob.client.rpc("express_rehome_interest", { p_case_id: sentCase });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: sentCase,
      p_recipient_id: bob.id,
    });
    await alice.client.rpc("mark_rehome_sent", { p_case_id: sentCase });
    expect(errorCode((await bob.client.rpc("decline_rehome", { p_case_id: sentCase })).error)).toBe(
      "P0001",
    );
    const sentStatus = await scalar("select status from public.rehome_cases where id = $1", [
      sentCase,
    ]);
    expect(sentStatus[0].status).toBe("sent");

    const doneCase = (await offered("Completed decline")).caseId;
    await bob.client.rpc("express_rehome_interest", { p_case_id: doneCase });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: doneCase,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: doneCase });
    expect(errorCode((await bob.client.rpc("decline_rehome", { p_case_id: doneCase })).error)).toBe(
      "P0001",
    );
    const doneStatus = await scalar("select status from public.rehome_cases where id = $1", [
      doneCase,
    ]);
    expect(doneStatus[0].status).toBe("completed");
  });

  it("a second decline after success is refused: no repeated change", async () => {
    const { caseId } = await offered("Repeat decline");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    expect((await bob.client.rpc("decline_rehome", { p_case_id: caseId })).error).toBeNull();
    // The recipient was cleared by the first decline, so a repeat is refused as not the selected recipient.
    expect(errorCode((await bob.client.rpc("decline_rehome", { p_case_id: caseId })).error)).toBe(
      "42501",
    );
    const status = await scalar(
      "select status, chosen_recipient_id from public.rehome_cases where id = $1",
      [caseId],
    );
    expect(status[0]).toEqual({ status: "available", chosen_recipient_id: null });
  });
});
