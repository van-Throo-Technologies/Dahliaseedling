import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayNames } from "@/modules/seedlings/repository";
import { PUBLIC_URL_SECONDS } from "@/modules/publications/limits";

/*
 * Reads for seed and seedhead offers. Every query runs as the reader, so row-level security and the column grants decide
 * what appears: visitors see live offers and their public source context, sellers see their own, and only the seller
 * sees who is interested. Nothing here returns an owner id of a source, a private original, or a private parent image.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type SourceKind = "seedling" | "cultivar" | "unidentified" | "unknown_mixed";

export interface OfferView {
  readonly id: string;
  readonly sellerId: string;
  readonly sellerName: string | null;
  readonly materialType: "loose_seeds" | "seedheads";
  readonly packetSize: number | null;
  readonly seedheadCount: number | null;
  readonly mode: "free" | "for_sale" | "trade";
  readonly priceText: string | null;
  readonly handover: "pickup" | "shipping" | "both";
  readonly note: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly closedAt: string | null;
  readonly sourceKind: SourceKind;
  readonly sourceSeedlingId: string | null;
  readonly sourceDescription: string | null;
  readonly photoUrls: readonly string[];
  readonly interested: readonly {
    readonly userId: string;
    readonly name: string;
    readonly quantity: string | null;
  }[];
  readonly iAmInterested: boolean;
}

const OFFER_COLUMNS = [
  "id",
  "seller_id",
  "material_type",
  "packet_size",
  "seedhead_count",
  "mode",
  "price_text",
  "handover_method",
  "note",
  "is_active",
  "created_at",
  "closed_at",
  "seed_sources!inner(source_seedling_id, source_cultivar_id, source_unidentified_id, source_unknown_mixed, unidentified_sources(description))",
].join(", ");

interface RawOffer {
  readonly id: string;
  readonly seller_id: string;
  readonly material_type: "loose_seeds" | "seedheads";
  readonly packet_size: number | null;
  readonly seedhead_count: number | null;
  readonly mode: "free" | "for_sale" | "trade";
  readonly price_text: string | null;
  readonly handover_method: "pickup" | "shipping" | "both";
  readonly note: string | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly closed_at: string | null;
  readonly seed_sources: {
    readonly source_seedling_id: string | null;
    readonly source_cultivar_id: string | null;
    readonly source_unidentified_id: string | null;
    readonly source_unknown_mixed: boolean;
    readonly unidentified_sources: { readonly description: string | null } | null;
  };
}

function kindOf(source: RawOffer["seed_sources"]): SourceKind {
  if (source.source_seedling_id) return "seedling";
  if (source.source_cultivar_id) return "cultivar";
  if (source.source_unidentified_id) return "unidentified";
  return "unknown_mixed";
}

/** Offers whose seed parent is this Seedling. Visitors see the live ones; the holder also sees their own inactive ones. */
export async function offersForSeedling(
  client: Client,
  seedlingId: string,
  viewerId: string | null,
): Promise<OfferView[]> {
  const { data, error } = await client
    .from("seed_offers")
    .select(OFFER_COLUMNS)
    .eq("seed_sources.source_seedling_id", seedlingId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return hydrate(client, (data ?? []) as unknown as RawOffer[], viewerId);
}

/** A grower's own live offers, for their profile. Other growers reading the profile see the same live set. */
export async function liveOffersBySeller(
  client: Client,
  sellerId: string,
  viewerId: string | null,
): Promise<OfferView[]> {
  const { data, error } = await client
    .from("seed_offers")
    .select(OFFER_COLUMNS)
    .eq("seller_id", sellerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return hydrate(client, (data ?? []) as unknown as RawOffer[], viewerId);
}

async function hydrate(
  client: Client,
  rows: readonly RawOffer[],
  viewerId: string | null,
): Promise<OfferView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const { data: media } = await client
    .from("seed_offer_media")
    .select("offer_id, public_derivatives(storage_path)")
    .in("offer_id", ids);
  const paths = new Map<string, string[]>();
  for (const link of (media ?? []) as unknown as {
    offer_id: string;
    public_derivatives: { storage_path: string } | null;
  }[]) {
    if (!link.public_derivatives) continue;
    paths.set(link.offer_id, [
      ...(paths.get(link.offer_id) ?? []),
      link.public_derivatives.storage_path,
    ]);
  }
  const everyPath = [...new Set([...paths.values()].flat())];
  const signed = new Map<string, string>();
  if (everyPath.length > 0) {
    const { data: urls } = await client.storage
      .from("public-media")
      .createSignedUrls(everyPath, PUBLIC_URL_SECONDS);
    for (const entry of urls ?? [])
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }

  // Only the seller sees who is interested, and only the active interests.
  const { data: interests } = await client
    .from("seed_offer_interests")
    .select("seed_offer_id, interested_user_id, requested_quantity")
    .in("seed_offer_id", ids)
    .is("withdrawn_at", null);
  const interestRows = (interests ?? []) as {
    seed_offer_id: string;
    interested_user_id: string;
    requested_quantity: string | null;
  }[];
  const names = await displayNames(client, [
    ...rows.map((row) => row.seller_id),
    ...interestRows.map((i) => i.interested_user_id),
  ]);

  return rows.map((row) => {
    const mine = viewerId === row.seller_id;
    const interested = mine
      ? interestRows
          .filter((i) => i.seed_offer_id === row.id)
          .map((i) => ({
            userId: i.interested_user_id,
            name: names.get(i.interested_user_id) ?? "",
            quantity: i.requested_quantity,
          }))
      : [];
    return {
      id: row.id,
      sellerId: row.seller_id,
      sellerName: names.get(row.seller_id) ?? null,
      materialType: row.material_type,
      packetSize: row.packet_size,
      seedheadCount: row.seedhead_count,
      mode: row.mode,
      priceText: row.price_text,
      handover: row.handover_method,
      note: row.note,
      isActive: row.is_active,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      sourceKind: kindOf(row.seed_sources),
      sourceSeedlingId: row.seed_sources.source_seedling_id,
      sourceDescription: row.seed_sources.unidentified_sources?.description ?? null,
      photoUrls: (paths.get(row.id) ?? [])
        .map((path) => signed.get(path))
        .filter((url): url is string => Boolean(url)),
      interested,
      iAmInterested:
        viewerId !== null &&
        interestRows.some((i) => i.seed_offer_id === row.id && i.interested_user_id === viewerId),
    };
  });
}

/** The unidentified dahlia's description for a parentage line, if the reader may see it. Otherwise null. */
export async function unidentifiedDescription(
  client: Client,
  sourceId: string,
): Promise<string | null> {
  const { data } = await client
    .from("unidentified_sources")
    .select("description")
    .eq("id", sourceId)
    .maybeSingle();
  return data?.description ?? null;
}

/** The grower's own unidentified sources, for reuse in the parentage form. The database returns only the caller's rows. */
export async function listMyUnidentifiedSources(
  client: Client,
): Promise<
  { readonly id: string; readonly description: string | null; readonly photoCount: number }[]
> {
  const { data } = await client.rpc("list_my_unidentified_sources");
  return (
    (data ?? []) as { source_id: string; description: string | null; photo_count: number }[]
  ).map((row) => ({
    id: row.source_id,
    description: row.description,
    photoCount: row.photo_count,
  }));
}
