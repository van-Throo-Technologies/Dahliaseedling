import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";

/*
 * Cursor-based pagination for Search. A page is 12 rows, and the database returns one more row so the caller can
 * tell whether another page exists. Each continuation resumes after the last row of the previous page, using the
 * total order (match tier, sort text, id). These tests prove that pages do not repeat rows, do not skip rows, end
 * correctly, and never bring back a private Seedling, a private parent or a suspended grower.
 *
 * The ordering itself is collation-dependent in Postgres, so the tests do not re-sort text in JavaScript. They
 * check that every match appears exactly once, and that the order is the same on every run.
 */

const PAGE = 12;
const created: string[] = [];
const visitor = anonClient();
const tag = "pg" + Math.random().toString(36).slice(2, 8);
let alice: TestUser; // NL: fourteen public seedlings named "Page <tag> NN", and the grower named "Pager <tag>"
let scout: TestUser; // DE: public seedlings named "Scout <tag> N", suspended later
const growerIds: string[] = []; // fourteen growers who each record the same local identifier
const sharedIdentifier = `PAGE-${tag.toUpperCase()}`;
const pageSeedlings: string[] = [];

interface Row {
  readonly match_tier: number;
  readonly sort_text: string;
  readonly [key: string]: unknown;
}

/** Reads every page of a search, the way the application does, and returns the pages in order. */
async function allPages(
  name: string,
  args: Record<string, unknown>,
  idKey: string,
): Promise<Row[][]> {
  const pages: Row[][] = [];
  let cursor: Record<string, unknown> = {};
  for (let guard = 0; guard < 200; guard++) {
    const { data, error } = await visitor.rpc(name, { ...args, p_limit: PAGE + 1, ...cursor });
    if (error) throw new Error(`${name}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    const page = rows.slice(0, PAGE);
    pages.push(page);
    if (rows.length <= PAGE) break;
    const last = page[PAGE - 1]!;
    cursor = {
      p_after_tier: last.match_tier,
      p_after_text: last.sort_text,
      p_after_id: last[idKey],
    };
  }
  return pages;
}

function ids(rows: readonly Row[], idKey: string): string[] {
  return rows.map((row) => row[idKey] as string);
}

beforeAll(async () => {
  alice = await createTestUser("page-alice");
  scout = await createTestUser("page-scout");
  created.push(alice.id, scout.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: `Pager ${tag}`, country_code: "NL" });
  await scout.client
    .from("profiles")
    .insert({ id: scout.id, display_name: `Scout ${tag}`, country_code: "DE" });

  for (let n = 1; n <= 14; n++) {
    const id = (
      await alice.client.rpc("create_seedling", {
        p_working_name: `Page ${tag} ${String(n).padStart(2, "0")}`,
        p_visibility: "public",
      })
    ).data!.id;
    pageSeedlings.push(id);
  }
  // A private seedling with the shared prefix: it must never appear on any page.
  await alice.client.rpc("create_seedling", {
    p_working_name: `Page ${tag} hidden`,
    p_visibility: "private",
  });
  // A suspended grower's seedlings use their own prefix, so the main count stays exact while they are visible.
  for (let n = 1; n <= 3; n++) {
    await scout.client.rpc("create_seedling", {
      p_working_name: `Scout ${tag} ${n}`,
      p_visibility: "public",
    });
  }

  // Fourteen growers, each with a public seedling that records the same local identifier.
  await withSuperuser(async (db) => {
    await db.query("set session_replication_role = replica");
    for (let n = 1; n <= 14; n++) {
      const id = crypto.randomUUID();
      growerIds.push(id);
      await db.query(
        "insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values ($1,'authenticated','authenticated',$2,'x',now(),now(),'{}','{}')",
        [id, `page-grower-${n}-${id}@example.test`],
      );
      await db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
        [id, `Rival ${tag} ${String(n).padStart(2, "0")}`],
      );
      const seedling = crypto.randomUUID();
      await db.query(
        "insert into public.seedlings (id, originator_id, current_holder_id, visibility, working_name) values ($1,$2,$2,'public',$3)",
        [seedling, id, `Shared ${tag} ${n}`],
      );
      await db.query(
        "insert into public.seedling_identifiers (seedling_id, identifier, kind, assigned_by, is_primary_for_user) values ($1,$2,'local',$3,false)",
        [seedling, sharedIdentifier, id],
      );
    }
  });
  created.push(...growerIds);

  for (let n = 1; n <= 14; n++) {
    await withSuperuser((db) =>
      db.query("insert into public.cultivar_references (name, normalized_name) values ($1, $2)", [
        `Page ${tag} cultivar ${String(n).padStart(2, "0")}`,
        `page ${tag} cultivar ${String(n).padStart(2, "0")}`,
      ]),
    );
  }
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("seedling pagination", () => {
  it("returns a first page of twelve, plus one probe row that shows a further page exists", async () => {
    const { data } = await visitor.rpc("search_seedlings", {
      p_query: `Page ${tag}`,
      p_country: null,
      p_limit: PAGE + 1,
    });
    expect(data!.length).toBe(PAGE + 1);
  });

  it("pages through every match: no duplicates, no gaps, and a final short page that ends the search", async () => {
    const pages = await allPages(
      "search_seedlings",
      { p_query: `Page ${tag}`, p_country: null },
      "seedling_id",
    );
    const all = ids(pages.flat(), "seedling_id");
    expect(pages.length).toBe(2);
    expect(pages[0]!.length).toBe(PAGE);
    expect(pages[1]!.length).toBe(2);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...pageSeedlings].sort());
  });

  it("gives the same order on every run, so a continuation always resumes at the same place", async () => {
    const first = ids(
      (
        await allPages(
          "search_seedlings",
          { p_query: `Page ${tag}`, p_country: null },
          "seedling_id",
        )
      ).flat(),
      "seedling_id",
    );
    const second = ids(
      (
        await allPages(
          "search_seedlings",
          { p_query: `Page ${tag}`, p_country: null },
          "seedling_id",
        )
      ).flat(),
      "seedling_id",
    );
    expect(second).toEqual(first);
  });

  it("paginates an ambiguous identifier matched by more than twelve growers, and each grower appears once", async () => {
    const pages = await allPages(
      "search_seedlings",
      { p_query: sharedIdentifier, p_country: null },
      "seedling_id",
    );
    const rows = pages.flat();
    expect(pages.length).toBe(2);
    expect(rows.length).toBe(14);
    expect(new Set(rows.map((row) => row.holder_id)).size).toBe(14);
    expect(new Set(ids(rows, "seedling_id")).size).toBe(14);
  });

  it("continues a country-only search and a query plus country search without repeating rows", async () => {
    const countryOnly = ids(
      (await allPages("search_seedlings", { p_query: "", p_country: "NL" }, "seedling_id")).flat(),
      "seedling_id",
    );
    expect(new Set(countryOnly).size).toBe(countryOnly.length);
    expect(pageSeedlings.every((id) => countryOnly.includes(id))).toBe(true);

    const combined = ids(
      (
        await allPages(
          "search_seedlings",
          { p_query: `Page ${tag}`, p_country: "NL" },
          "seedling_id",
        )
      ).flat(),
      "seedling_id",
    );
    expect(combined.length).toBe(14);
    expect(new Set(combined).size).toBe(14);

    const none = await allPages(
      "search_seedlings",
      { p_query: `Page ${tag}`, p_country: "BE" },
      "seedling_id",
    );
    expect(none).toEqual([[]]);
  });

  it("never returns a private seedling on any page, and a suspended grower's seedlings disappear from every page", async () => {
    const visible = ids(
      (
        await allPages(
          "search_seedlings",
          { p_query: `Page ${tag}`, p_country: null },
          "seedling_id",
        )
      ).flat(),
      "seedling_id",
    );
    expect(visible.length).toBe(14);

    const scoutBefore = (
      await allPages(
        "search_seedlings",
        { p_query: `Scout ${tag}`, p_country: null },
        "seedling_id",
      )
    ).flat();
    expect(scoutBefore.length).toBe(3);

    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [scout.id]),
    );
    try {
      const scoutAfter = (
        await allPages(
          "search_seedlings",
          { p_query: `Scout ${tag}`, p_country: null },
          "seedling_id",
        )
      ).flat();
      expect(scoutAfter.length).toBe(0);
      const hiddenAfter = ids(
        (
          await allPages(
            "search_seedlings",
            { p_query: `Page ${tag}`, p_country: null },
            "seedling_id",
          )
        ).flat(),
        "seedling_id",
      );
      expect(hiddenAfter.length).toBe(14);
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [scout.id]),
      );
    }
  });
});

describe("parentage pagination", () => {
  it("pages more than twelve seedlings reached through a cultivar parent, one row per seedling", async () => {
    const cultivar = `Parent ${tag}`;
    for (let n = 1; n <= 14; n++) {
      const child = (
        await alice.client.rpc("create_seedling", {
          p_working_name: `Child ${tag} ${String(n).padStart(2, "0")}`,
          p_visibility: "public",
        })
      ).data!.id;
      // Half are seed-parent children and half pollen-parent children, so both roles page together.
      await alice.client.rpc("set_seedling_parent", {
        p_seedling_id: child,
        p_role: n % 2 === 0 ? "seed_parent" : "pollen_parent",
        p_kind: "cultivar",
        p_cultivar_name: cultivar,
      });
    }
    const pages = await allPages(
      "search_seedlings",
      { p_query: cultivar, p_country: null },
      "seedling_id",
    );
    const rows = pages.flat();
    expect(pages.length).toBe(2);
    expect(rows.length).toBe(14);
    expect(new Set(ids(rows, "seedling_id")).size).toBe(14);
    expect(rows.every((row) => row.match_reason === "parent_cultivar")).toBe(true);
  });
});

describe("cultivar and grower pagination", () => {
  it("pages cultivar references through every match, with no repeats", async () => {
    const pages = await allPages(
      "search_cultivars",
      { p_query: `page ${tag} cultivar` },
      "cultivar_id",
    );
    const rows = pages.flat();
    expect(pages.length).toBe(2);
    expect(rows.length).toBe(14);
    expect(new Set(ids(rows, "cultivar_id")).size).toBe(14);
  });

  it("pages growers through every match, and suspended growers never appear", async () => {
    // Matches for the shared tag: the owner ("Pager <tag>"), fourteen "Rival <tag> NN" growers and the scout.
    // Sixteen growers, so the second page holds four.
    const pages = await allPages("search_growers", { p_query: tag, p_country: null }, "profile_id");
    const rows = pages.flat();
    expect(pages.length).toBe(2);
    expect(pages[1]!.length).toBe(4);
    expect(new Set(ids(rows, "profile_id")).size).toBe(16);
    expect(
      rows.every(
        (row) =>
          growerIds.includes(row.profile_id as string) ||
          row.profile_id === alice.id ||
          row.profile_id === scout.id,
      ),
    ).toBe(true);
  });
});

describe("continuation past the last row", () => {
  it("returns an empty page when the cursor sits after every match", async () => {
    const { data } = await visitor.rpc("search_growers", {
      p_query: tag,
      p_country: null,
      p_limit: PAGE + 1,
      p_after_tier: 5,
      p_after_text: "zzz",
      p_after_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    expect(data).toEqual([]);
  });
});
