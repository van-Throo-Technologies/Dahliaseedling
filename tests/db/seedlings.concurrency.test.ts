import { afterAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  removeTestUsers,
  type TestUser,
  withSuperuser,
} from "../support/local-supabase";

/*
 * Concurrent identifier allocation. Each request is its own transaction, sent in parallel through the
 * API, as two tabs or two devices would send them. Every test uses a fresh grower so the expected
 * numbers are exact.
 */

const created: string[] = [];

async function newGrower(label: string): Promise<TestUser> {
  const grower = await createTestUser(label);
  created.push(grower.id);
  const profile = await grower.client
    .from("profiles")
    .insert({ id: grower.id, display_name: `Grower ${label}`, country_code: "BE" });
  expect(profile.error).toBeNull();
  return grower;
}

async function seriesCreate(grower: TestUser, name: string, includeYear: boolean): Promise<string> {
  const series = await grower.client.rpc("create_series", {
    p_name: name,
    p_include_year: includeYear,
  });
  expect(series.error).toBeNull();
  return series.data!.id;
}

async function identifiersOf(grower: TestUser, kind: string): Promise<string[]> {
  const result = await withSuperuser((db) =>
    db.query(
      `select si.identifier from public.seedling_identifiers si
         join public.seedlings s on s.id = si.seedling_id
        where s.originator_id = $1 and si.kind = $2`,
      [grower.id, kind],
    ),
  );
  return result.rows.map((row) => row.identifier as string);
}

function failuresOf(results: Array<{ error: { message: string } | null }>): string[] {
  return results.flatMap((result) => (result.error ? [result.error.message] : []));
}

afterAll(async () => {
  await removeTestUsers(created);
});

describe("concurrent allocation", () => {
  it("same Series and same year: 20 parallel creations give JV-26-001 through JV-26-020", async () => {
    const grower = await newGrower("same-year");
    const series = await seriesCreate(grower, "JV", true);

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        grower.client.rpc("create_seedling", { p_series_id: series, p_first_grown_year: 2026 }),
      ),
    );
    expect(failuresOf(results)).toEqual([]);

    const identifiers = await identifiersOf(grower, "series");
    expect(identifiers.sort()).toEqual(
      Array.from({ length: 20 }, (_, index) => `JV-26-${String(index + 1).padStart(3, "0")}`),
    );
  });

  it("same Series, two years in parallel: each cohort starts at 001 and counts independently", async () => {
    const grower = await newGrower("cross-year");
    const series = await seriesCreate(grower, "JV", true);

    const requests = [
      ...Array.from({ length: 10 }, () =>
        grower.client.rpc("create_seedling", { p_series_id: series, p_first_grown_year: 2026 }),
      ),
      ...Array.from({ length: 10 }, () =>
        grower.client.rpc("create_seedling", { p_series_id: series, p_first_grown_year: 2027 }),
      ),
    ];
    const results = await Promise.all(requests);
    expect(failuresOf(results)).toEqual([]);

    const identifiers = await identifiersOf(grower, "series");
    const expected = [
      ...Array.from({ length: 10 }, (_, index) => `JV-26-${String(index + 1).padStart(3, "0")}`),
      ...Array.from({ length: 10 }, (_, index) => `JV-27-${String(index + 1).padStart(3, "0")}`),
    ];
    expect(identifiers.sort()).toEqual(expected.sort());
  });

  it("a Series without a year token keeps one lifetime sequence, whatever the years are", async () => {
    const grower = await newGrower("yearless");
    const series = await seriesCreate(grower, "YL", false);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        grower.client.rpc("create_seedling", {
          p_series_id: series,
          p_first_grown_year: index % 2 === 0 ? 2026 : undefined,
        }),
      ),
    );
    expect(failuresOf(results)).toEqual([]);

    const identifiers = await identifiersOf(grower, "series");
    expect(identifiers.sort()).toEqual(
      Array.from({ length: 10 }, (_, index) => `YL-${String(index + 1).padStart(3, "0")}`),
    );
  });

  it("automatic numbers stay unique and gap-free alongside Series creations", async () => {
    const grower = await newGrower("auto-mixed");
    const series = await seriesCreate(grower, "JV", true);

    const results = await Promise.all([
      ...Array.from({ length: 10 }, () =>
        grower.client.rpc("create_seedling", { p_series_id: series, p_first_grown_year: 2026 }),
      ),
      ...Array.from({ length: 10 }, () => grower.client.rpc("create_seedling", {})),
    ]);
    expect(failuresOf(results)).toEqual([]);

    const automatic = await identifiersOf(grower, "automatic");
    expect(automatic.map(Number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("attaching Series identifiers in parallel to seedlings of one cohort stays unique", async () => {
    const grower = await newGrower("attach");
    const series = await seriesCreate(grower, "JV", true);
    const seedlings = await Promise.all(
      Array.from({ length: 10 }, () =>
        grower.client.rpc("create_seedling", { p_first_grown_year: 2026 }),
      ),
    );
    const ids = seedlings.map((result) => result.data!.id);

    const results = await Promise.all(
      ids.map((id) =>
        grower.client.rpc("attach_series_identifier", { p_seedling_id: id, p_series_id: series }),
      ),
    );
    expect(failuresOf(results)).toEqual([]);

    const identifiers = await identifiersOf(grower, "series");
    expect(identifiers.sort()).toEqual(
      Array.from({ length: 10 }, (_, index) => `JV-26-${String(index + 1).padStart(3, "0")}`),
    );
  });
});
