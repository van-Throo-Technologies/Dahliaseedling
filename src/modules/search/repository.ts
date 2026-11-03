import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { seedlingCover, type PublicImage } from "@/modules/publications/repository";
import { PUBLIC_URL_SECONDS } from "@/modules/publications/limits";
import { encodeCursor, readCursor, type CursorBinding, type CursorPosition } from "./cursor";
import { SEARCH_RESULT_LIMIT } from "./normalize";
import type { SearchInput } from "./validation";

/*
 * Search reads through its database functions, each SECURITY INVOKER. The reader's own session decides what is
 * visible: a private Seedling, a suspended grower, a closed offer, or a private parent never reaches this code. The
 * cover image comes from the existing public-derivative path, so Search never reads an Observation original.
 *
 * Each group pages on its own. The database returns one row more than a page, which tells this code whether a
 * further page exists, and the cursor for that page is built from the last row shown. Groups never share a cursor.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The rows shown per group on one page. */
export const SEARCH_PAGE_SIZE = SEARCH_RESULT_LIMIT;

export type SeedlingReason =
  "identifier" | "working_name" | "parent_cultivar" | "parent_seedling" | "country" | "available";

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

/**
 * A seed or seedhead offer. It is not a Seedling. Its source is shown honestly: an existing Seedling, a named cultivar, an
 * unidentified dahlia (with the grower's own description, never as a name), or unknown or mixed. No interest, no owner id
 * beyond the public grower, and no private media reaches this type.
 */
export interface SeedOfferResult {
  readonly offerId: string;
  readonly materialType: "loose_seeds" | "seedheads";
  readonly packetSize: number | null;
  readonly seedheadCount: number | null;
  readonly mode: "free" | "for_sale" | "trade";
  readonly priceText: string | null;
  readonly handover: "pickup" | "shipping" | "both";
  readonly sourceKind: "seedling" | "cultivar" | "unidentified" | "unknown_mixed";
  readonly sourceSeedlingId: string | null;
  readonly sourceSeedlingName: string | null;
  readonly sourceCultivarName: string | null;
  readonly sourceDescription: string | null;
  readonly sellerName: string;
  readonly sellerCountry: string | null;
  /** A signed URL for the public derivative of its photograph, or null when there is none to show. */
  readonly photoUrl: string | null;
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
  readonly seedOffers: GroupPage<SeedOfferResult>;
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
  readonly seedOffers?: string;
}

const REASONS: readonly SeedlingReason[] = [
  "identifier",
  "working_name",
  "parent_cultivar",
  "parent_seedling",
  "country",
  "available",
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
  seedOffers: emptyPage(),
  invalidCursor: false,
  failed: false,
};

/**
 * Runs Search for one page of each group. With no query and no country, nothing is searched: the page shows the
 * Feed. Cultivar References have no country, so a country filter leaves them out rather than guessing their location.
 *
 * The two availability filters stay separate. The Seedling availability filter returns Seedlings looking for a new
 * grower and suppresses offers. The seeds filter returns Seed and Seedhead Offers only. With both on, nothing matches:
 * a Seedling and an offer are different things, so the intersection is empty.
 */
export async function searchPublic(
  client: Client,
  input: SearchInput,
  cursors: SearchCursors = {},
): Promise<SearchResults> {
  const active = input.query !== null || input.country !== null || input.available || input.seeds;
  if (!active) return EMPTY;

  const binding: CursorBinding = {
    query: input.query,
    country: input.country,
    available: input.available,
    seeds: input.seeds,
  };
  const readSeedlings = readCursor(cursors.seedlings, binding);
  const readCultivars = readCursor(cursors.cultivars, binding);
  const readGrowers = readCursor(cursors.growers, binding);
  const readOffers = readCursor(cursors.seedOffers, binding);
  const invalidCursor = !readSeedlings.ok || !readCultivars.ok || !readGrowers.ok || !readOffers.ok;

  const query = input.query ?? "";
  const country = input.country ?? undefined;
  const searchSeedlings = !input.seeds;
  const searchCultivars =
    input.query !== null && input.country === null && !input.available && !input.seeds;
  const searchGrowers = !input.available && !input.seeds;
  const searchOffers =
    !input.available && (input.seeds || input.query !== null || input.country !== null);
  const probe = SEARCH_PAGE_SIZE + 1;

  const seedlingAfter = readSeedlings.ok ? readSeedlings.position : null;
  const cultivarAfter = readCultivars.ok ? readCultivars.position : null;
  const growerAfter = readGrowers.ok ? readGrowers.position : null;
  const offerAfter = readOffers.ok ? readOffers.position : null;

  const [seedlings, cultivars, growers, offers] = await Promise.all([
    searchSeedlings
      ? client.rpc("search_seedlings", {
          p_query: query,
          p_country: country,
          p_limit: probe,
          p_available: input.available,
          ...afterArgs(seedlingAfter),
        })
      : Promise.resolve({ data: [], error: null }),
    searchCultivars
      ? client.rpc("search_cultivars", {
          p_query: query,
          p_limit: probe,
          ...afterArgs(cultivarAfter),
        })
      : Promise.resolve({ data: [], error: null }),
    searchGrowers
      ? client.rpc("search_growers", {
          p_query: query,
          p_country: country,
          p_limit: probe,
          ...afterArgs(growerAfter),
        })
      : Promise.resolve({ data: [], error: null }),
    searchOffers
      ? client.rpc("search_seed_offers", {
          p_query: input.query ?? undefined,
          p_country: country,
          p_limit: probe,
          p_after_text: offerAfter?.sortText ?? undefined,
          p_after_id: offerAfter?.id ?? undefined,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (seedlings.error || cultivars.error || growers.error || offers.error) {
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

  const offerRows = offers.data ?? [];
  const offerShown = offerRows.slice(0, SEARCH_PAGE_SIZE);
  const offerLast = offerShown[offerShown.length - 1];
  const photoPaths = offerShown.flatMap((row) => (row.photo_path ? [row.photo_path] : []));
  const signed = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data: urls } = await client.storage
      .from("public-media")
      .createSignedUrls(photoPaths, PUBLIC_URL_SECONDS);
    for (const entry of urls ?? [])
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }
  const offerItems: SeedOfferResult[] = offerShown.map((row) => ({
    offerId: row.offer_id,
    materialType: row.material_type as SeedOfferResult["materialType"],
    packetSize: row.packet_size,
    seedheadCount: row.seedhead_count,
    mode: row.mode as SeedOfferResult["mode"],
    priceText: row.price_text,
    handover: row.handover_method as SeedOfferResult["handover"],
    sourceKind: row.source_kind as SeedOfferResult["sourceKind"],
    sourceSeedlingId: row.source_seedling_id,
    sourceSeedlingName: row.source_seedling_name,
    sourceCultivarName: row.source_cultivar_name,
    sourceDescription: row.source_description,
    sellerName: row.seller_name,
    sellerCountry: row.seller_country,
    photoUrl: row.photo_path ? (signed.get(row.photo_path) ?? null) : null,
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
    seedOffers: {
      items: offerItems,
      next:
        offerRows.length > SEARCH_PAGE_SIZE && offerLast
          ? encodeCursor(binding, {
              tier: offerLast.match_tier,
              sortText: offerLast.sort_text,
              id: offerLast.offer_id,
            })
          : null,
      current: offerAfter ? (cursors.seedOffers ?? null) : null,
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
