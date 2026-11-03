import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  type TestUser,
} from "../support/local-supabase";

/*
 * The Search availability filter reads canonical continuation state. Only an available case of a public Seedling
 * matches. Pending, sent, completed and withdrawn cases never do, and a completed transfer moves the country that
 * Search filters on to the new holder.
 */

const visitor = anonClient();
const tag = "sa" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser; // NL
let bob: TestUser; // BE
const available: string[] = [];
let pending = "";
let completed = "";
let withdrawn = "";

interface Hit {
  seedling_id: string;
  match_reason: string;
}

async function search(args: Record<string, unknown>): Promise<Hit[]> {
  const { data, error } = await visitor.rpc("search_seedlings", args);
  if (error) throw new Error(error.message);
  return (data ?? []) as Hit[];
}

beforeAll(async () => {
  alice = await createTestUser("sa-alice");
  bob = await createTestUser("sa-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: `Bob ${tag}`, country_code: "BE" });

  for (let n = 1; n <= 13; n++) {
    const seedling = (
      await alice.client.rpc("create_seedling", {
        p_working_name: `Avail ${tag} ${String(n).padStart(2, "0")}`,
        p_visibility: "public",
      })
    ).data!.id;
    await alice.client.rpc("start_rehome", { p_seedling_id: seedling, p_term: "donate" });
    available.push(seedling);
  }

  pending = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Pending ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  const pendingCase = (
    await alice.client.rpc("start_rehome", { p_seedling_id: pending, p_term: "donate" })
  ).data as string;
  await bob.client.rpc("express_rehome_interest", { p_case_id: pendingCase });
  await alice.client.rpc("choose_rehome_recipient", {
    p_case_id: pendingCase,
    p_recipient_id: bob.id,
  });

  withdrawn = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Withdrawn ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  const withdrawnCase = (
    await alice.client.rpc("start_rehome", { p_seedling_id: withdrawn, p_term: "donate" })
  ).data as string;
  await alice.client.rpc("cancel_rehome", { p_case_id: withdrawnCase });

  completed = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Done ${tag}`,
      p_visibility: "public",
    })
  ).data!.id;
  const doneCase = (
    await alice.client.rpc("start_rehome", { p_seedling_id: completed, p_term: "donate" })
  ).data as string;
  await bob.client.rpc("express_rehome_interest", { p_case_id: doneCase });
  await alice.client.rpc("choose_rehome_recipient", {
    p_case_id: doneCase,
    p_recipient_id: bob.id,
  });
  await bob.client.rpc("confirm_rehome_received", { p_case_id: doneCase });
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("availability filter", () => {
  it("returns only available public seedlings, and never a pending, completed or withdrawn one", async () => {
    const hits = (
      await search({ p_query: `Avail ${tag}`, p_country: null, p_limit: 13, p_available: true })
    ).map((h) => h.seedling_id);
    expect([...new Set(hits)].sort()).toEqual([...available].sort());
    for (const id of [pending, completed, withdrawn]) {
      expect(
        await search({ p_query: `${tag}`, p_country: null, p_limit: 13, p_available: true }),
      ).not.toContainEqual(expect.objectContaining({ seedling_id: id }));
    }
  });

  it("returns an available seedling with no Update, because the filter reads continuation state, not the Feed", async () => {
    const hits = await search({
      p_query: `Avail ${tag}`,
      p_country: null,
      p_limit: 13,
      p_available: true,
    });
    expect(hits.map((h) => h.seedling_id)).toEqual(expect.arrayContaining(available.slice(0, 1)));
  });

  it("combines with a country: the holder's canonical country decides", async () => {
    expect(
      (await search({ p_query: `Avail ${tag}`, p_country: "NL", p_limit: 13, p_available: true }))
        .length,
    ).toBe(13);
    expect(
      await search({ p_query: `Avail ${tag}`, p_country: "BE", p_limit: 13, p_available: true }),
    ).toEqual([]);
  });

  it("paginates an availability search: twelve, then the rest, with nothing repeated", async () => {
    const first = await search({
      p_query: `Avail ${tag}`,
      p_country: null,
      p_limit: 13,
      p_available: true,
    });
    const last = first[11]!;
    const lastRow = last as unknown as { match_tier: number; sort_text: string };
    const { data } = await visitor.rpc("search_seedlings", {
      p_query: `Avail ${tag}`,
      p_country: null,
      p_limit: 13,
      p_available: true,
      p_after_tier: lastRow.match_tier,
      p_after_text: lastRow.sort_text,
      p_after_id: last.seedling_id,
    });
    const rest = (data ?? []) as Hit[];
    expect(rest).toHaveLength(1);
    const all = [...first.slice(0, 12), ...rest].map((h) => h.seedling_id);
    expect(new Set(all).size).toBe(13);
  });

  it("follows the new holder's country after a completed transfer, and the seedling leaves the filter", async () => {
    // Bob (BE) now holds the completed seedling: it matches Belgium, not the Netherlands.
    expect(
      (await search({ p_query: `Done ${tag}`, p_country: "BE", p_limit: 12 })).map(
        (h) => h.seedling_id,
      ),
    ).toContain(completed);
    expect(await search({ p_query: `Done ${tag}`, p_country: "NL", p_limit: 12 })).toEqual([]);
    // A completed transfer is not available, so the availability filter does not return it.
    expect(
      await search({ p_query: `Done ${tag}`, p_country: null, p_limit: 12, p_available: true }),
    ).toEqual([]);
  });

  it("keeps identifier and working-name search working after a transfer", async () => {
    const hits = await search({ p_query: `Done ${tag}`, p_country: null, p_limit: 12 });
    expect(hits.map((h) => h.seedling_id)).toContain(completed);
  });
});
