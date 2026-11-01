import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  errorCode,
  removeTestUsers,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * Identifier rules: {YY} from the first-grown year, per-Series/year sequences, yearless sequences,
 * later attachment of a Series identifier, and immutability of identifiers.
 */

const created: string[] = [];
let grower: TestUser;

async function identifiersFor(seedlingId: string) {
  return withSuperuser(async (db) => {
    const result = await db.query(
      "select identifier, kind, is_primary_for_user, is_retired_alias from public.seedling_identifiers where seedling_id = $1 order by created_at",
      [seedlingId],
    );
    return result.rows as Array<{
      identifier: string;
      kind: string;
      is_primary_for_user: boolean;
      is_retired_alias: boolean;
    }>;
  });
}

function seriesIdentifier(rows: Array<{ identifier: string; kind: string }>): string | undefined {
  return rows.find((row) => row.kind === "series")?.identifier;
}

beforeAll(async () => {
  grower = await createTestUser("identifiers");
  created.push(grower.id);
  const profile = await grower.client
    .from("profiles")
    .insert({ id: grower.id, display_name: "Identifier Grower", country_code: "DE" });
  expect(profile.error).toBeNull();
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("{YY} comes from the first-grown year", () => {
  let jv: string;

  it("creates a Series with a year token", async () => {
    const series = await grower.client.rpc("create_series", { p_name: "JV", p_include_year: true });
    expect(series.data?.pattern).toBe("JV-{YY}-{NNN}");
    jv = series.data!.id;
  });

  it("uses the first-grown year, not the year the record was created", async () => {
    // The record is created now, in the present year. The seedling was first grown in 2024.
    const created = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2024,
    });
    expect(created.error).toBeNull();
    const identifiers = await identifiersFor(created.data!.id);
    expect(seriesIdentifier(identifiers)).toBe("JV-24-001");
  });

  it("increments within the same Series and cohort year", async () => {
    const created = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2024,
    });
    expect(seriesIdentifier(await identifiersFor(created.data!.id))).toBe("JV-24-002");
  });

  it("starts the next cohort year at 001", async () => {
    const created = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2025,
    });
    expect(seriesIdentifier(await identifiersFor(created.data!.id))).toBe("JV-25-001");
  });

  it("keeps the automatic number independent of the Series and the year", async () => {
    const created = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2025,
    });
    const identifiers = await identifiersFor(created.data!.id);
    const automatic = identifiers.find((row) => row.kind === "automatic");
    expect(automatic?.identifier).toMatch(/^\d+$/);
    expect(automatic?.is_primary_for_user).toBe(false);
  });

  it("refuses a year-based Series when the seedling has no first-grown year", async () => {
    const { error } = await grower.client.rpc("create_seedling", { p_series_id: jv });
    expect(errorCode(error)).toBe("23514");
    expect(error?.message).toContain("first grown year");
  });

  it("still creates a seedling without a year, with its automatic number", async () => {
    const created = await grower.client.rpc("create_seedling", {});
    expect(created.error).toBeNull();
    expect(created.data?.first_grown_year).toBeNull();
    const identifiers = await identifiersFor(created.data!.id);
    expect(identifiers).toHaveLength(1);
    expect(identifiers[0]).toMatchObject({ kind: "automatic", is_primary_for_user: true });
  });

  it("adds the Series identifier later, once the year is known, without changing the UUID or automatic number", async () => {
    const seedling = await grower.client.rpc("create_seedling", {});
    const id = seedling.data!.id;
    const before = await identifiersFor(id);

    // Attaching needs the year first.
    const early = await grower.client.rpc("attach_series_identifier", {
      p_seedling_id: id,
      p_series_id: jv,
    });
    expect(errorCode(early.error)).toBe("23514");

    const setYear = await grower.client
      .from("seedlings")
      .update({ first_grown_year: 2026 })
      .eq("id", id)
      .select("id");
    expect(setYear.data).toHaveLength(1);

    const attached = await grower.client.rpc("attach_series_identifier", {
      p_seedling_id: id,
      p_series_id: jv,
    });
    expect(attached.error).toBeNull();
    expect(attached.data).toMatchObject({
      identifier: "JV-26-001",
      kind: "series",
      is_primary_for_user: true,
    });

    const after = await identifiersFor(id);
    expect(after.find((row) => row.kind === "automatic")?.identifier).toBe(before[0]?.identifier);
    expect(after.find((row) => row.kind === "automatic")?.is_primary_for_user).toBe(false);
    const row = await withSuperuser((db) =>
      db.query("select id from public.seedlings where id = $1", [id]),
    );
    expect(row.rows[0]?.id).toBe(id);
  });

  it("refuses a second identifier from the same Series on one seedling", async () => {
    const seedling = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2026,
    });
    const again = await grower.client.rpc("attach_series_identifier", {
      p_seedling_id: seedling.data!.id,
      p_series_id: jv,
    });
    expect(errorCode(again.error)).toBe("23505");
  });

  it("does not rewrite an existing Series identifier when the first-grown year changes", async () => {
    const seedling = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2026,
    });
    const id = seedling.data!.id;
    const before = seriesIdentifier(await identifiersFor(id));
    // Earlier tests already used the 2026 cohort (001 and 002), so this seedling is 003.
    expect(before).toBe("JV-26-003");

    const changed = await grower.client
      .from("seedlings")
      .update({ first_grown_year: 2027 })
      .eq("id", id)
      .select("first_grown_year");
    expect(changed.data).toEqual([{ first_grown_year: 2027 }]);
    expect(seriesIdentifier(await identifiersFor(id))).toBe("JV-26-003");

    // A new seedling for the new year gets the new cohort, and the old identifier is untouched.
    const next = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2027,
    });
    expect(seriesIdentifier(await identifiersFor(next.data!.id))).toBe("JV-27-001");
  });

  it("refuses an identifier value that is already used in the grower's namespace", async () => {
    await expect(
      withSuperuser((db) =>
        db.query(
          "insert into public.seedling_identifiers (seedling_id, identifier, kind, assigned_by, series_id) values ((select id from public.seedlings where originator_id = $1 limit 1), 'JV-26-001', 'series', $1, $2)",
          [grower.id, jv],
        ),
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("never reissues a retired number, so the next cohort number is still the next one", async () => {
    const seedling = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2028,
    });
    const id = seedling.data!.id;
    const row = (await identifiersFor(id)).find((item) => item.kind === "series")!;
    expect(row.identifier).toBe("JV-28-001");
    await withSuperuser((db) =>
      db.query(
        "update public.seedling_identifiers set is_retired_alias = true, is_primary_for_user = false where seedling_id = $1 and kind = 'series'",
        [id],
      ),
    );
    const next = await grower.client.rpc("create_seedling", {
      p_series_id: jv,
      p_first_grown_year: 2028,
    });
    expect(seriesIdentifier(await identifiersFor(next.data!.id))).toBe("JV-28-002");
  });
});

describe("a Series without a year token", () => {
  let yl: string;

  it("keeps one lifetime sequence, whatever first-grown years the seedlings have", async () => {
    const series = await grower.client.rpc("create_series", {
      p_name: "YL",
      p_include_year: false,
    });
    expect(series.data?.pattern).toBe("YL-{NNN}");
    yl = series.data!.id;

    const first = await grower.client.rpc("create_seedling", {
      p_series_id: yl,
      p_first_grown_year: 2026,
    });
    const second = await grower.client.rpc("create_seedling", {
      p_series_id: yl,
      p_first_grown_year: 2027,
    });
    const third = await grower.client.rpc("create_seedling", { p_series_id: yl });
    expect(seriesIdentifier(await identifiersFor(first.data!.id))).toBe("YL-001");
    expect(seriesIdentifier(await identifiersFor(second.data!.id))).toBe("YL-002");
    expect(seriesIdentifier(await identifiersFor(third.data!.id))).toBe("YL-003");
  });

  it("does not need a year to allocate", async () => {
    const seedling = await grower.client.rpc("create_seedling", { p_series_id: yl });
    expect(seedling.error).toBeNull();
    expect(seriesIdentifier(await identifiersFor(seedling.data!.id))).toBe("YL-004");
  });
});
