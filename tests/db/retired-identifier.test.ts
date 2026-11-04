import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * A retired identifier typed into Search resolves to the canonical Seedling it was merged into. A live identifier does not resolve,
 * an unknown one resolves to nothing, and the canonical Seedling is revealed to a visitor only where it is public.
 */

const tag = "ri" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let canonical = "";
let duplicate = "";
let retiredIdentifier = "";
let liveIdentifier = "";

beforeAll(async () => {
  alice = await createTestUser("ri-alice");
  created.push(alice.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Alice ${tag}`, country_code: "NL" });
  canonical = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Keep ${tag}`,
      p_visibility: "public",
    })
  ).data!.id as string;
  duplicate = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Retire ${tag}`,
      p_visibility: "public",
    })
  ).data!.id as string;
  // Per-grower numbers repeat across growers, so the fixture gives the duplicate a Series identifier (unique within its Series and year).
  const series = await alice.client.rpc("create_series", {
    p_name: tag.toUpperCase(),
    p_include_year: true,
  });
  expect(series.error).toBeNull();
  expect(
    (await alice.client.from("seedlings").update({ first_grown_year: 2026 }).eq("id", duplicate))
      .error,
  ).toBeNull();
  const attached = await alice.client.rpc("attach_series_identifier", {
    p_seedling_id: duplicate,
    p_series_id: series.data!.id as string,
  });
  expect(attached.error).toBeNull();
  retiredIdentifier = (attached.data as { identifier: string }).identifier;

  expect(
    (
      await alice.client.rpc("merge_seedlings", {
        p_canonical: canonical,
        p_duplicate: duplicate,
        p_confirmed: true,
      })
    ).error,
  ).toBeNull();
  liveIdentifier = (
    await withSuperuser((db) =>
      db.query(
        "select identifier from public.seedling_identifiers where seedling_id = $1 and is_retired_alias = false limit 1",
        [canonical],
      ),
    )
  ).rows[0].identifier as string;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("retired identifiers resolve to the canonical Seedling", () => {
  it("a retired identifier resolves to the canonical Seedling, ignoring case and a leading #", async () => {
    expect(
      (await visitor.rpc("resolve_retired_identifier", { p_query: retiredIdentifier })).data,
    ).toBe(canonical);
    expect(
      (
        await visitor.rpc("resolve_retired_identifier", {
          p_query: `#${retiredIdentifier.toLowerCase()}`,
        })
      ).data,
    ).toBe(canonical);
  });

  it("a live identifier, and an unknown one, resolve to nothing", async () => {
    expect(
      (await visitor.rpc("resolve_retired_identifier", { p_query: liveIdentifier })).data,
    ).toBeNull();
    expect(
      (await visitor.rpc("resolve_retired_identifier", { p_query: "ZZ-NOPE-000" })).data,
    ).toBeNull();
    expect((await visitor.rpc("resolve_retired_identifier", { p_query: "" })).data).toBeNull();
  });

  it("the identifier is still stored unchanged on the retired record, and is never reissued", async () => {
    const rows = await withSuperuser((db) =>
      db.query(
        "select identifier, is_retired_alias from public.seedling_identifiers where seedling_id = $1",
        [duplicate],
      ),
    );
    expect(
      rows.rows.some((r) => r.identifier === retiredIdentifier && r.is_retired_alias === true),
    ).toBe(true);
  });
});
