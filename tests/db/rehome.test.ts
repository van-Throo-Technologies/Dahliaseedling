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
 * Continuation (Rehome). The holder makes a Seedling available, growers express interest, the holder chooses one
 * recipient, and the recipient's confirmation of receipt is the only thing that changes the holder. Every rule here is
 * enforced by the database: the tests call the functions the app calls, as the real roles, and check the tables.
 */

const created: string[] = [];
const visitor = anonClient();
const tag = "rh" + Math.random().toString(36).slice(2, 8);
let alice: TestUser; // originator and first holder
let bob: TestUser; // interested grower, later holder
let carol: TestUser; // interested grower
let dave: TestUser; // a third grower, suspended in one test

async function publicSeedling(owner: TestUser, label: string): Promise<string> {
  const { data, error } = await owner.client.rpc("create_seedling", {
    p_working_name: `${label} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id;
}

/** A public seedling of the holder with an available case, donate terms. */
async function available(holder: TestUser, label: string) {
  const seedling = await publicSeedling(holder, label);
  const { data, error } = await holder.client.rpc("start_rehome", {
    p_seedling_id: seedling,
    p_term: "donate",
    p_handover: "pickup",
  });
  if (error) throw new Error(error.message);
  return { seedling, caseId: data as string };
}

async function scalar(sql: string, params: unknown[]) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function holderOf(seedling: string): Promise<string> {
  const rows = await scalar("select current_holder_id from public.seedlings where id = $1", [
    seedling,
  ]);
  return rows[0].current_holder_id as string;
}

beforeAll(async () => {
  alice = await createTestUser("rehome-alice");
  bob = await createTestUser("rehome-bob");
  carol = await createTestUser("rehome-carol");
  dave = await createTestUser("rehome-dave");
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

describe("starting availability", () => {
  it("only the current grower can make a seedling available", async () => {
    const seedling = await publicSeedling(alice, "Start");
    const { error } = await bob.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "donate",
    });
    expect(errorCode(error)).toBe("42501");
  });

  it("a private seedling is not made public silently: the holder must say so in the same step", async () => {
    const seedling = (await alice.client.rpc("create_seedling", { p_working_name: `Quiet ${tag}` }))
      .data!.id;
    const refused = await alice.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "donate",
    });
    expect(errorCode(refused.error)).toBe("23514");
    expect(
      await scalar("select visibility from public.seedlings where id = $1", [seedling]),
    ).toEqual([{ visibility: "private" }]);

    const allowed = await alice.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "donate",
      p_make_public: true,
    });
    expect(allowed.error).toBeNull();
    expect(
      await scalar("select visibility from public.seedlings where id = $1", [seedling]),
    ).toEqual([{ visibility: "public" }]);
  });

  it("accepts donate, sell and trade, refuses anything else, and keeps a price for sale only", async () => {
    const seedling = await publicSeedling(alice, "Terms");
    expect(
      errorCode(
        (await alice.client.rpc("start_rehome", { p_seedling_id: seedling, p_term: "free" })).error,
      ),
    ).toBe("23514");
    expect(
      errorCode(
        (
          await alice.client.rpc("start_rehome", {
            p_seedling_id: seedling,
            p_term: "donate",
            p_price_text: "10 EUR",
          })
        ).error,
      ),
    ).toBe("23514");
    const sell = await alice.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "sell",
      p_price_text: "10 EUR",
    });
    expect(sell.error).toBeNull();
    await alice.client.rpc("cancel_rehome", { p_case_id: sell.data });
    const trade = await alice.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "trade",
    });
    expect(trade.error).toBeNull();
  });

  it("holds exactly one active continuation per seedling", async () => {
    const { seedling } = await available(alice, "Once");
    const second = await alice.client.rpc("start_rehome", {
      p_seedling_id: seedling,
      p_term: "donate",
    });
    expect(errorCode(second.error)).toBe("23505");
  });

  it("has no health declaration and no plant-passport or shipping-compliance fields", async () => {
    const columns = (
      await scalar(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name in ('rehome_cases', 'rehome_interests')",
        [],
      )
    ).map((row) => String(row.column_name));
    expect(columns.some((name) => /health|passport|phyto|customs|compliance/.test(name))).toBe(
      false,
    );
  });
});

describe("interest", () => {
  it("refuses a visitor, and the holder's interest in their own seedling", async () => {
    const { caseId } = await available(alice, "Interest");
    expect(
      errorCode((await visitor.rpc("express_rehome_interest", { p_case_id: caseId })).error),
    ).toBe("42501");
    expect(
      errorCode((await alice.client.rpc("express_rehome_interest", { p_case_id: caseId })).error),
    ).toBe("42501");
  });

  it("lets several growers express interest, and repeating it returns the same interest", async () => {
    const { caseId } = await available(alice, "Several");
    const first = await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    const again = await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    const other = await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    expect(first.error).toBeNull();
    expect(again.data).toBe(first.data);
    expect(other.error).toBeNull();
    expect(
      await scalar(
        "select count(*)::int as n from public.rehome_interests where rehome_case_id = $1",
        [caseId],
      ),
    ).toEqual([{ n: 2 }]);
  });

  it("keeps interests private: the holder sees them, another interested grower and a visitor do not", async () => {
    const { caseId, seedling } = await available(alice, "Private interest");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });

    const holderPanel = await alice.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect((holderPanel.data as { role: string; interests: unknown[] }).role).toBe("holder");
    expect((holderPanel.data as { interests: unknown[] }).interests).toHaveLength(2);

    const bobRows = await bob.client
      .from("rehome_interests")
      .select("interested_user_id")
      .eq("rehome_case_id", caseId);
    expect(bobRows.data!.map((row) => row.interested_user_id)).toEqual([bob.id]);

    const bobPanel = await bob.client.rpc("rehome_panel", { p_seedling_id: seedling });
    expect((bobPanel.data as { role: string; interests: unknown[] }).role).toBe("interested");
    expect((bobPanel.data as { interests: unknown[] }).interests).toEqual([]);

    const visitorPanel = await visitor.rpc("rehome_panel", { p_seedling_id: seedling });
    expect((visitorPanel.data as { interests: unknown[]; role: string }).interests).toEqual([]);
    expect((visitorPanel.data as { role: string }).role).toBe("visitor");
    expect((visitorPanel.data as { case: { note: unknown } }).case.note).toBeNull();
    const anonRows = await visitor.from("rehome_interests").select("id");
    expect(anonRows.data ?? []).toEqual([]);
  });

  it("gives the holder of a private seedling with nothing active the holder role, so the way to start is shown", async () => {
    const created = await alice.client.rpc("create_seedling", {
      p_working_name: "Holder without a case",
      p_visibility: "private",
    });
    const panel = await alice.client.rpc("rehome_panel", { p_seedling_id: created.data!.id });
    expect((panel.data as { role: string; case: unknown }).role).toBe("holder");
    expect((panel.data as { case: unknown }).case).toBeNull();
  });
});

describe("choosing one recipient and the transfer boundary", () => {
  it("refuses a non-holder's choice, and the holder choosing themselves", async () => {
    const { caseId } = await available(alice, "Choose");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    expect(
      errorCode(
        (
          await bob.client.rpc("choose_rehome_recipient", {
            p_case_id: caseId,
            p_recipient_id: bob.id,
          })
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client.rpc("choose_rehome_recipient", {
            p_case_id: caseId,
            p_recipient_id: alice.id,
          })
        ).error,
      ),
    ).toBe("23514");
  });

  it("choosing a recipient does not transfer the holder", async () => {
    const { caseId, seedling } = await available(alice, "Arranged");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    const chose = await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    expect(chose.error).toBeNull();
    expect(await holderOf(seedling)).toBe(alice.id);
    const status = await scalar("select status from public.rehome_cases where id = $1", [caseId]);
    expect(status).toEqual([{ status: "arranged" }]);
  });

  it("only the selected recipient confirms receipt: the holder, another grower and a visitor are refused", async () => {
    const { caseId, seedling } = await available(alice, "Confirm");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });

    expect(
      errorCode((await alice.client.rpc("confirm_rehome_received", { p_case_id: caseId })).error),
    ).toBe("42501");
    expect(
      errorCode((await carol.client.rpc("confirm_rehome_received", { p_case_id: caseId })).error),
    ).toBe("42501");
    expect(
      errorCode((await visitor.rpc("confirm_rehome_received", { p_case_id: caseId })).error),
    ).toBe("42501");
    expect(await holderOf(seedling)).toBe(alice.id);
  });

  it("the selected recipient's confirmation transfers the holder, appends one provenance event, and keeps the originator", async () => {
    const { caseId, seedling } = await available(alice, "Transfer");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    const confirmed = await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    expect(confirmed.data).toBe("completed");

    expect(await holderOf(seedling)).toBe(bob.id);
    const origin = await scalar("select originator_id from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(origin).toEqual([{ originator_id: alice.id }]);
    const events = await scalar(
      "select event_type, from_holder_id, to_holder_id from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(events).toEqual([
      { event_type: "continuation_received", from_holder_id: alice.id, to_holder_id: bob.id },
    ]);
  });

  it("a double confirmation is safe: no second transfer and no second provenance event", async () => {
    const { caseId, seedling } = await available(alice, "Double");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    const [first, second] = await Promise.all([
      bob.client.rpc("confirm_rehome_received", { p_case_id: caseId }),
      bob.client.rpc("confirm_rehome_received", { p_case_id: caseId }),
    ]);
    expect([first.data, second.data].sort()).toEqual(["already_completed", "completed"]);
    const events = await scalar(
      "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(events).toEqual([{ n: 1 }]);
  });
});

describe("concurrency", () => {
  it("two holder choices for different recipients: exactly one recipient is chosen", async () => {
    const { caseId } = await available(alice, "Race");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    const results = await Promise.allSettled([
      alice.client.rpc("choose_rehome_recipient", { p_case_id: caseId, p_recipient_id: bob.id }),
      alice.client.rpc("choose_rehome_recipient", { p_case_id: caseId, p_recipient_id: carol.id }),
    ]);
    const succeeded = results.filter((r) => r.status === "fulfilled" && !r.value.error);
    expect(succeeded).toHaveLength(1);
    const chosen = await scalar(
      "select chosen_recipient_id from public.rehome_cases where id = $1",
      [caseId],
    );
    expect([bob.id, carol.id]).toContain(chosen[0].chosen_recipient_id);
  });

  it("a stale sender cannot transfer: if the holder changed unexpectedly, the case is cancelled, not completed", async () => {
    const { caseId, seedling } = await available(alice, "Stale");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    // The holder is changed outside the confirmation path. The database must not let this case move the Seedling.
    await withSuperuser(async (db) => {
      await db.query("set session_replication_role = replica");
      await db.query("update public.seedlings set current_holder_id = $2 where id = $1", [
        seedling,
        carol.id,
      ]);
    });
    const result = await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    expect(result.data).toBe("stale");
    expect(await holderOf(seedling)).toBe(carol.id);
    const status = await scalar("select status from public.rehome_cases where id = $1", [caseId]);
    expect(status).toEqual([{ status: "cancelled" }]);
  });
});

describe("authority after transfer", () => {
  it("the old holder loses holder-only authority; the new holder gains it; the identity persists", async () => {
    const { caseId, seedling } = await available(alice, "Authority");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });

    // Old holder: cannot start another continuation, change the working name, or attach a series.
    expect(
      errorCode(
        (await alice.client.rpc("start_rehome", { p_seedling_id: seedling, p_term: "donate" }))
          .error,
      ),
    ).toBe("42501");
    const renamed = await alice.client
      .from("seedlings")
      .update({ working_name: "Stolen" })
      .eq("id", seedling)
      .select("id");
    expect(renamed.data ?? []).toEqual([]);

    // New holder: holds the same Seedling UUID and can edit it.
    const edited = await bob.client
      .from("seedlings")
      .update({ working_name: `Continued ${tag}` })
      .eq("id", seedling)
      .select("id");
    expect(edited.data).toHaveLength(1);
    expect(await holderOf(seedling)).toBe(bob.id);
  });

  it("private Observations of the earlier holder stay with their author and are not visible to the new holder", async () => {
    const { caseId, seedling } = await available(alice, "Private history");
    const observation = crypto.randomUUID();
    await withSuperuser(async (db) => {
      await db.query("set session_replication_role = replica");
      await db.query(
        "insert into public.observations (id, seedling_id, author_id, observed_at, note) values ($1, $2, $3, now(), $4)",
        [observation, seedling, alice.id, `Private note ${tag}`],
      );
    });
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });

    const seenByNewHolder = await bob.client
      .from("observations")
      .select("id")
      .eq("id", observation);
    expect(seenByNewHolder.data ?? []).toEqual([]);
    const seenByVisitor = await visitor.from("observations").select("id").eq("id", observation);
    expect(seenByVisitor.data ?? []).toEqual([]);
    const ownerStill = await alice.client.from("observations").select("id").eq("id", observation);
    expect(ownerStill.data).toHaveLength(1);
  });

  it("identifiers are not rewritten by the transfer", async () => {
    const { caseId, seedling } = await available(alice, "Identifiers");
    const before = await scalar(
      "select identifier, kind from public.seedling_identifiers where seedling_id = $1 order by identifier",
      [seedling],
    );
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    const after = await scalar(
      "select identifier, kind from public.seedling_identifiers where seedling_id = $1 order by identifier",
      [seedling],
    );
    expect(after).toEqual(before);
  });
});

describe("lifetime transfers and the originator", () => {
  it("supports A to B to C, with the provenance chain in order and the originator unchanged", async () => {
    const { caseId: first, seedling } = await available(alice, "Chain");
    await bob.client.rpc("express_rehome_interest", { p_case_id: first });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: first, p_recipient_id: bob.id });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: first });

    const second = (
      await bob.client.rpc("start_rehome", { p_seedling_id: seedling, p_term: "donate" })
    ).data as string;
    await carol.client.rpc("express_rehome_interest", { p_case_id: second });
    await bob.client.rpc("choose_rehome_recipient", {
      p_case_id: second,
      p_recipient_id: carol.id,
    });
    await carol.client.rpc("confirm_rehome_received", { p_case_id: second });

    expect(await holderOf(seedling)).toBe(carol.id);
    const chain = await scalar(
      "select from_holder_id, to_holder_id from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received' order by occurred_at, id",
      [seedling],
    );
    expect(chain).toEqual([
      { from_holder_id: alice.id, to_holder_id: bob.id },
      { from_holder_id: bob.id, to_holder_id: carol.id },
    ]);
    const origin = await scalar("select originator_id from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(origin).toEqual([{ originator_id: alice.id }]);
  });

  it("the originator may later legitimately become the recipient, and the holder changes back", async () => {
    // Alice originates the seedling, passes it to Bob, and later receives it back as a recipient.
    const { caseId: out, seedling } = await available(alice, "Return");
    await bob.client.rpc("express_rehome_interest", { p_case_id: out });
    await alice.client.rpc("choose_rehome_recipient", { p_case_id: out, p_recipient_id: bob.id });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: out });

    const back = (
      await bob.client.rpc("start_rehome", { p_seedling_id: seedling, p_term: "donate" })
    ).data as string;
    await alice.client.rpc("express_rehome_interest", { p_case_id: back });
    await bob.client.rpc("choose_rehome_recipient", { p_case_id: back, p_recipient_id: alice.id });
    expect((await alice.client.rpc("confirm_rehome_received", { p_case_id: back })).data).toBe(
      "completed",
    );

    expect(await holderOf(seedling)).toBe(alice.id);
    const origin = await scalar("select originator_id from public.seedlings where id = $1", [
      seedling,
    ]);
    expect(origin).toEqual([{ originator_id: alice.id }]);
  });
});

describe("withdrawal, cancellation and recovery", () => {
  it("an available seedling can be withdrawn with no holder change and no provenance event", async () => {
    const { caseId, seedling } = await available(alice, "Withdraw");
    expect((await alice.client.rpc("cancel_rehome", { p_case_id: caseId })).data).toBe(true);
    expect(await holderOf(seedling)).toBe(alice.id);
    const events = await scalar(
      "select count(*)::int as n from public.provenance_events where seedling_id = $1 and event_type = 'continuation_received'",
      [seedling],
    );
    expect(events).toEqual([{ n: 0 }]);
    expect(errorCode((await alice.client.rpc("cancel_rehome", { p_case_id: caseId })).error)).toBe(
      "P0001",
    );
  });

  it("a cancelled arrangement cannot be confirmed as if it were pending", async () => {
    const { caseId, seedling } = await available(alice, "Cancel arranged");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await alice.client.rpc("cancel_rehome", { p_case_id: caseId });
    expect(
      errorCode((await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId })).error),
    ).toBe("P0001");
    expect(await holderOf(seedling)).toBe(alice.id);
  });

  it("a failed arrangement can be reopened, and the holder can then choose again", async () => {
    const { caseId } = await available(alice, "Reopen");
    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await carol.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    expect((await alice.client.rpc("reopen_rehome", { p_case_id: caseId })).data).toBe(true);
    const row = await scalar(
      "select status, chosen_recipient_id from public.rehome_cases where id = $1",
      [caseId],
    );
    expect(row).toEqual([{ status: "available", chosen_recipient_id: null }]);
    expect(
      (
        await alice.client.rpc("choose_rehome_recipient", {
          p_case_id: caseId,
          p_recipient_id: carol.id,
        })
      ).error,
    ).toBeNull();
  });
});

describe("suspension", () => {
  it("a suspended grower cannot express interest, and a completed transfer survives a later suspension", async () => {
    const { caseId, seedling } = await available(alice, "Suspension");
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [dave.id]),
    );
    try {
      expect(
        errorCode((await dave.client.rpc("express_rehome_interest", { p_case_id: caseId })).error),
      ).toBe("42501");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [dave.id]),
      );
    }

    await bob.client.rpc("express_rehome_interest", { p_case_id: caseId });
    await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseId,
      p_recipient_id: bob.id,
    });
    await bob.client.rpc("confirm_rehome_received", { p_case_id: caseId });
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [bob.id]),
    );
    try {
      expect(await holderOf(seedling)).toBe(bob.id);
      expect(
        (await scalar("select status from public.rehome_cases where id = $1", [caseId]))[0].status,
      ).toBe("completed");
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [bob.id]),
      );
    }
  });
});
