import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { seedlingCover, type PublicImage } from "@/modules/publications/repository";
import { encodeCursor, readCursor, type CursorBinding, type CursorPosition } from "./cursor";
import { SEARCH_RESULT_LIMIT } from "./normalize";
import type { SearchInput } from "./validation";

/*
 * Search reads through three database functions, each SECURITY INVOKER. The reader's own session decides what is
 * visible: a private Seedling, a suspended grower, or a private parent never reaches this code. The cover image
 * comes from the existing public-derivative path, so Search never reads an Observation original.
 *
 * Each group pages on its own. The database returns one row more than a page, which tells this code whether a
 * further page exists, and the cursor for that page is built from the last row shown. Groups never share a cursor.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The rows shown per group on one page. */
export const SEARCH_PAGE_SIZE = SEARCH_RESULT_LIMIT;

export type SeedlingReason =
  "identifier" | "working_name" | "parent_cultivar" | "parent_seedling" | "country";

export interface SeedlingResult {
  readonly seedlingId: string;
  readonly reason: SeedlingReason;
  readonly primaryIdentifier: string | null;
  readonly primaryKind: string | null;
  readonly workingName: string | null;
  readonly holderId: string;
  readonly holderName: string;
  readonly holderCountry: string;
  readonly cover: PublicImage | null;
}

export interface CultivarResult {
  readonly cultivarId: string;
  readonly name: string;
  readonly seedParentCount: number;
  readonly pollenParentCount: number;
}

export interface GrowerResult {
  readonly profileId: string;
  readonly displayName: string;
  readonly countryCode: string;
  readonly accountType: string | null;
}

/** One group's page: its rows, the cursor for the next page, and the cursor this page was read with. */
export interface GroupPage<T> {
  readonly items: readonly T[];
  /** Opaque cursor for the next page of this group, or null when this is the last page. */
  readonly next: string | null;
  /** The cursor this page was read with, or null on the first page. Kept so other groups keep their place. */
  readonly current: string | null;
}

export interface SearchResults {
  readonly seedlings: GroupPage<SeedlingResult>;
  readonly cultivars: GroupPage<CultivarResult>;
  readonly growers: GroupPage<GrowerResult>;
  /** True when a cursor was not issued for this search. The first results are shown instead, and the page says so. */
  readonly invalidCursor: boolean;
  /** True when the database could not answer. The page shows a neutral message, never the database error. */
  readonly failed: boolean;
}

/** The cursors the page received, one per group. Each is optional. */
export interface SearchCursors {
  readonly seedlings?: string;
  readonly cultivars?: string;
  readonly growers?: string;
}

const REASONS: readonly SeedlingReason[] = [
  "identifier",
  "working_name",
  "parent_cultivar",
  "parent_seedling",
  "country",
];

function reasonOf(value: string): SeedlingReason {
  return (REASONS as readonly string[]).includes(value)
    ? (value as SeedlingReason)
    : "working_name";
}

function emptyPage<T>(): GroupPage<T> {
  return { items: [], next: null, current: null };
}

const EMPTY: SearchResults = {
  seedlings: emptyPage(),
  cultivars: emptyPage(),
  growers: emptyPage(),
  invalidCursor: false,
  failed: false,
};

/**
 * Runs Search for one page of each group. With no query and no country, nothing is searched: the page shows the
 * Feed. Cultivar References have no country, so a country filter leaves them out rather than guessing their
 * location.
 */
export async function searchPublic(
  client: Client,
  input: SearchInput,
  cursors: SearchCursors = {},
): Promise<SearchResults> {
  const active = input.query !== null || input.country !== null;
  if (!active) return EMPTY;

  const binding: CursorBinding = { query: input.query, country: input.country };
  const readSeedlings = readCursor(cursors.seedlings, binding);
  const readCultivars = readCursor(cursors.cultivars, binding);
  const readGrowers = readCursor(cursors.growers, binding);
  const invalidCursor = !readSeedlings.ok || !readCultivars.ok || !readGrowers.ok;

  const query = input.query ?? "";
  const country = input.country ?? undefined;
  const searchCultivars = input.query !== null && input.country === null;
  const probe = SEARCH_PAGE_SIZE + 1;

  const seedlingAfter = readSeedlings.ok ? readSeedlings.position : null;
  const cultivarAfter = readCultivars.ok ? readCultivars.position : null;
  const growerAfter = readGrowers.ok ? readGrowers.position : null;

  const [seedlings, cultivars, growers] = await Promise.all([
    client.rpc("search_seedlings", {
      p_query: query,
      p_country: country,
      p_limit: probe,
      ...afterArgs(seedlingAfter),
    }),
    searchCultivars
      ? client.rpc("search_cultivars", {
          p_query: query,
          p_limit: probe,
          ...afterArgs(cultivarAfter),
        })
      : Promise.resolve({ data: [], error: null }),
    client.rpc("search_growers", {
      p_query: query,
      p_country: country,
      p_limit: probe,
      ...afterArgs(growerAfter),
    }),
  ]);

  if (seedlings.error || cultivars.error || growers.error) {
    return { ...EMPTY, invalidCursor, failed: true };
  }

  const seedlingRows = seedlings.data ?? [];
  const seedlingShown = seedlingRows.slice(0, SEARCH_PAGE_SIZE);
  const seedlingLast = seedlingShown[seedlingShown.length - 1];
  const seedlingItems: SeedlingResult[] = await Promise.all(
    seedlingShown.map(async (row) => ({
      seedlingId: row.seedling_id,
      reason: reasonOf(row.match_reason),
      primaryIdentifier: row.primary_identifier,
      primaryKind: row.primary_kind,
      workingName: row.working_name,
      holderId: row.holder_id,
      holderName: row.holder_name,
      holderCountry: row.holder_country,
      cover: await seedlingCover(client, row.seedling_id),
    })),
  );

  const cultivarRows = cultivars.data ?? [];
  const cultivarShown = cultivarRows.slice(0, SEARCH_PAGE_SIZE);
  const cultivarLast = cultivarShown[cultivarShown.length - 1];
  const cultivarItems: CultivarResult[] = cultivarShown.map((row) => ({
    cultivarId: row.cultivar_id,
    name: row.cultivar_name,
    seedParentCount: row.seed_parent_count,
    pollenParentCount: row.pollen_parent_count,
  }));

  const growerRows = growers.data ?? [];
  const growerShown = growerRows.slice(0, SEARCH_PAGE_SIZE);
  const growerLast = growerShown[growerShown.length - 1];
  const growerItems: GrowerResult[] = growerShown.map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    countryCode: row.country_code,
    accountType: row.account_type_label,
  }));

  return {
    seedlings: {
      items: seedlingItems,
      next:
        seedlingRows.length > SEARCH_PAGE_SIZE && seedlingLast
          ? encodeCursor(binding, {
              tier: seedlingLast.match_tier,
              sortText: seedlingLast.sort_text,
              id: seedlingLast.seedling_id,
            })
          : null,
      current: seedlingAfter ? (cursors.seedlings ?? null) : null,
    },
    cultivars: {
      items: cultivarItems,
      next:
        cultivarRows.length > SEARCH_PAGE_SIZE && cultivarLast
          ? encodeCursor(binding, {
              tier: cultivarLast.match_tier,
              sortText: cultivarLast.sort_text,
              id: cultivarLast.cultivar_id,
            })
          : null,
      current: cultivarAfter ? (cursors.cultivars ?? null) : null,
    },
    growers: {
      items: growerItems,
      next:
        growerRows.length > SEARCH_PAGE_SIZE && growerLast
          ? encodeCursor(binding, {
              tier: growerLast.match_tier,
              sortText: growerLast.sort_text,
              id: growerLast.profile_id,
            })
          : null,
      current: growerAfter ? (cursors.growers ?? null) : null,
    },
    invalidCursor,
    failed: false,
  };
}

/** The continuation arguments for a database call. A first page passes no position, so the function defaults apply. */
function afterArgs(position: CursorPosition | null) {
  if (!position) return {};
  return {
    p_after_tier: position.tier,
    p_after_text: position.sortText,
    p_after_id: position.id,
  };
}
