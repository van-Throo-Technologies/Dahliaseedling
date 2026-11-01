import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ParentInput, Visibility } from "./validation";

/*
 * Data access for Seedling core. Every call runs with the caller's own session, so RLS decides
 * what is visible. Writes go through the domain functions, never through table inserts.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type SeedlingRow = Pick<
  Database["public"]["Tables"]["seedlings"]["Row"],
  | "id"
  | "originator_id"
  | "current_holder_id"
  | "visibility"
  | "working_name"
  | "first_grown_year"
  | "created_at"
>;
type IdentifierRow = Database["public"]["Tables"]["seedling_identifiers"]["Row"];

export interface Seedling {
  readonly id: string;
  readonly originatorId: string;
  readonly currentHolderId: string;
  readonly visibility: Visibility;
  readonly workingName: string | null;
  readonly firstGrownYear: number | null;
  readonly createdAt: string;
}

export interface SeedlingIdentifier {
  readonly identifier: string;
  readonly kind: IdentifierRow["kind"];
  readonly isPrimary: boolean;
  readonly isRetiredAlias: boolean;
}

export interface SeriesSummary {
  readonly id: string;
  readonly name: string;
  readonly pattern: string;
  readonly active: boolean;
}

export interface ParentLink {
  readonly role: "seed_parent" | "pollen_parent";
  readonly isUnknown: boolean;
  readonly parentSeedlingId: string | null;
  readonly cultivarName: string | null;
  readonly notes: string | null;
}

export interface ProvenanceEntry {
  readonly eventType: string;
  readonly occurredAt: string;
  readonly toHolderId: string | null;
}

const SEEDLING_COLUMNS =
  "id, originator_id, current_holder_id, visibility, working_name, first_grown_year, created_at";

function toSeedling(row: SeedlingRow): Seedling {
  return {
    id: row.id,
    originatorId: row.originator_id,
    currentHolderId: row.current_holder_id,
    visibility: row.visibility,
    workingName: row.working_name,
    firstGrownYear: row.first_grown_year,
    createdAt: row.created_at,
  };
}

export async function createSeedlingRecord(
  client: Client,
  input: {
    readonly seriesId: string | null;
    readonly workingName: string | null;
    readonly firstGrownYear: number | null;
    readonly visibility: Visibility;
  },
): Promise<Seedling> {
  const { data, error } = await client.rpc("create_seedling", {
    p_series_id: input.seriesId ?? undefined,
    p_working_name: input.workingName ?? undefined,
    p_first_grown_year: input.firstGrownYear ?? undefined,
    p_visibility: input.visibility,
  });
  if (error || !data) throw new SeedlingError(error?.message ?? "Could not create the seedling.");
  return toSeedling(data);
}

export class SeedlingError extends Error {}

export async function getSeedling(client: Client, id: string): Promise<Seedling | null> {
  const { data, error } = await client
    .from("seedlings")
    .select(SEEDLING_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new SeedlingError("Could not read the seedling.");
  return data ? toSeedling(data) : null;
}

export async function listHeldSeedlings(client: Client, holderId: string): Promise<Seedling[]> {
  const { data, error } = await client
    .from("seedlings")
    .select(SEEDLING_COLUMNS)
    .eq("current_holder_id", holderId)
    .order("created_at", { ascending: false });
  if (error) throw new SeedlingError("Could not read your seedlings.");
  return data.map(toSeedling);
}

/** Changes the presentation fields a holder may edit. Returns null if RLS allowed no change. */
export async function updateSeedlingCore(
  client: Client,
  id: string,
  patch: {
    readonly workingName: string | null;
    readonly firstGrownYear: number | null;
    readonly visibility: Visibility;
  },
): Promise<Seedling | null> {
  const { data, error } = await client
    .from("seedlings")
    .update({
      working_name: patch.workingName,
      first_grown_year: patch.firstGrownYear,
      visibility: patch.visibility,
    })
    .eq("id", id)
    .select(SEEDLING_COLUMNS)
    .maybeSingle();
  if (error) throw new SeedlingError("Could not save the seedling.");
  return data ? toSeedling(data) : null;
}

export async function listIdentifiers(
  client: Client,
  seedlingId: string,
): Promise<SeedlingIdentifier[]> {
  const { data, error } = await client
    .from("seedling_identifiers")
    .select("identifier, kind, is_primary_for_user, is_retired_alias, created_at")
    .eq("seedling_id", seedlingId)
    .order("created_at", { ascending: true });
  if (error) throw new SeedlingError("Could not read identifiers.");
  return data.map((row) => ({
    identifier: row.identifier,
    kind: row.kind,
    isPrimary: row.is_primary_for_user,
    isRetiredAlias: row.is_retired_alias,
  }));
}

/** Display identifier: the primary series identifier if there is one, otherwise the automatic number. */
export function displayIdentifier(identifiers: readonly SeedlingIdentifier[]): string {
  const primary = identifiers.find(
    (identifier) => identifier.isPrimary && !identifier.isRetiredAlias,
  );
  if (primary)
    return primary.kind === "automatic" ? `Seedling #${primary.identifier}` : primary.identifier;
  const automatic = identifiers.find((identifier) => identifier.kind === "automatic");
  return automatic ? `Seedling #${automatic.identifier}` : "Seedling";
}

export async function listSeries(client: Client): Promise<SeriesSummary[]> {
  const { data, error } = await client
    .from("series")
    .select("id, name, pattern, active")
    .order("name", { ascending: true });
  if (error) throw new SeedlingError("Could not read your series.");
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    active: row.active,
  }));
}

export async function createSeriesRecord(
  client: Client,
  name: string,
  includeYear: boolean,
): Promise<SeriesSummary> {
  const { data, error } = await client.rpc("create_series", {
    p_name: name,
    p_include_year: includeYear,
  });
  if (error || !data)
    throw new SeedlingError(
      error?.code === "23505"
        ? `You already have a series named ${name}.`
        : (error?.message ?? "Could not create the series."),
    );
  return { id: data.id, name: data.name, pattern: data.pattern, active: data.active };
}

export async function listParentage(client: Client, seedlingId: string): Promise<ParentLink[]> {
  const { data, error } = await client
    .from("seedling_parentage")
    .select("role, is_unknown, parent_seedling_id, notes, cultivar_references(name)")
    .eq("child_seedling_id", seedlingId);
  if (error) throw new SeedlingError("Could not read parentage.");
  return data.map((row) => ({
    role: row.role === "pollen_parent" ? "pollen_parent" : "seed_parent",
    isUnknown: row.is_unknown,
    parentSeedlingId: row.parent_seedling_id,
    cultivarName: row.cultivar_references?.name ?? null,
    notes: row.notes,
  }));
}

export async function setParentRecord(
  client: Client,
  seedlingId: string,
  input: ParentInput,
): Promise<void> {
  const { error } = await client.rpc("set_seedling_parent", {
    p_seedling_id: seedlingId,
    p_role: input.role,
    p_kind: input.kind,
    p_parent_seedling_id: input.parentSeedlingId ?? undefined,
    p_cultivar_name: input.cultivarName || undefined,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw new SeedlingError(error.message);
}

export async function listProvenance(
  client: Client,
  seedlingId: string,
): Promise<ProvenanceEntry[]> {
  const { data, error } = await client
    .from("provenance_events")
    .select("event_type, occurred_at, to_holder_id")
    .eq("seedling_id", seedlingId)
    .order("occurred_at", { ascending: true });
  if (error) throw new SeedlingError("Could not read provenance.");
  return data.map((row) => ({
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    toHolderId: row.to_holder_id,
  }));
}

/** Names for profiles that are visible to the reader. A hidden profile simply has no name. */
export async function displayNames(
  client: Client,
  profileIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(profileIds)];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data, error } = await client.from("profiles").select("id, display_name").in("id", unique);
  if (error) throw new SeedlingError("Could not read grower names.");
  for (const row of data) names.set(row.id, row.display_name);
  return names;
}

/** Identifiers of other seedlings, used for parent links. RLS hides anything the reader cannot see. */
export async function displayLabels(
  client: Client,
  seedlingIds: readonly string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(seedlingIds)];
  if (unique.length === 0) return result;
  const { data, error } = await client
    .from("seedling_identifiers")
    .select("seedling_id, identifier, kind, is_primary_for_user, is_retired_alias")
    .in("seedling_id", unique);
  if (error) throw new SeedlingError("Could not read parent identifiers.");
  const grouped = new Map<string, SeedlingIdentifier[]>();
  for (const row of data) {
    const list = grouped.get(row.seedling_id) ?? [];
    list.push({
      identifier: row.identifier,
      kind: row.kind,
      isPrimary: row.is_primary_for_user,
      isRetiredAlias: row.is_retired_alias,
    });
    grouped.set(row.seedling_id, list);
  }
  for (const [id, identifiers] of grouped) result.set(id, displayIdentifier(identifiers));
  return result;
}

/** Attaches a Series identifier to an existing seedling the caller holds. */
export async function attachSeriesRecord(
  client: Client,
  seedlingId: string,
  seriesId: string,
): Promise<void> {
  const { error } = await client.rpc("attach_series_identifier", {
    p_seedling_id: seedlingId,
    p_series_id: seriesId,
  });
  if (error)
    throw new SeedlingError(
      error.code === "23505"
        ? "This seedling already has an identifier from that series."
        : error.message,
    );
}

/** Escapes LIKE wildcards so user text is matched literally. */
function literal(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export interface ParentCandidate {
  readonly id: string;
  readonly label: string;
  readonly ownerName: string | null;
}

/**
 * Finds seedlings the reader may choose as a parent: by exact identifier (a Series identifier, or one of
 * the reader's own automatic numbers) or by the start of a working name. RLS applies to every row, so a
 * private seedling of someone else is never returned, and nothing about it is revealed.
 */
export async function findParentCandidates(
  client: Client,
  input: { readonly term: string; readonly excludeSeedlingId: string; readonly readerId: string },
): Promise<ParentCandidate[]> {
  const term = input.term.trim().replace(/^#/, "");
  if (term.length === 0 || term.length > 40) return [];
  const escaped = literal(term);

  const identifierRows = await client
    .from("seedling_identifiers")
    .select("seedling_id, kind, assigned_by")
    .ilike("identifier", escaped)
    .limit(10);
  if (identifierRows.error) throw new SeedlingError("Could not search seedlings.");

  const ids = new Set<string>();
  for (const row of identifierRows.data) {
    const ownNumber = row.kind === "automatic" && row.assigned_by === input.readerId;
    if (row.kind === "series" || ownNumber) ids.add(row.seedling_id);
  }

  const nameRows = await client
    .from("seedlings")
    .select("id")
    .ilike("working_name", `${escaped}%`)
    .is("deleted_at", null)
    .limit(10);
  if (nameRows.error) throw new SeedlingError("Could not search seedlings.");
  for (const row of nameRows.data) ids.add(row.id);

  ids.delete(input.excludeSeedlingId);
  const found = [...ids].slice(0, 10);
  if (found.length === 0) return [];

  const [labels, holders] = await Promise.all([
    displayLabels(client, found),
    client.from("seedlings").select("id, current_holder_id, working_name").in("id", found),
  ]);
  if (holders.error) throw new SeedlingError("Could not search seedlings.");
  const holderIds = holders.data.map((row) => row.current_holder_id);
  const owners = await displayNames(client, holderIds);

  return holders.data.map((row) => {
    const label = labels.get(row.id) ?? "Seedling";
    return {
      id: row.id,
      label: row.working_name ? `${label} · ${row.working_name}` : label,
      ownerName: owners.get(row.current_holder_id) ?? null,
    };
  });
}

/** Series identifiers already on a seedling, so the attach form offers only the others. */
export async function attachedSeriesIds(client: Client, seedlingId: string): Promise<string[]> {
  const { data, error } = await client
    .from("seedling_identifiers")
    .select("series_id")
    .eq("seedling_id", seedlingId)
    .eq("kind", "series");
  if (error) throw new SeedlingError("Could not read identifiers.");
  return data.flatMap((row) => (row.series_id ? [row.series_id] : []));
}

/** Working names for seedlings the reader may see. A hidden seedling has no entry. */
export async function workingNames(
  client: Client,
  seedlingIds: readonly string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(seedlingIds)];
  const names = new Map<string, string | null>();
  if (unique.length === 0) return names;
  const { data, error } = await client
    .from("seedlings")
    .select("id, working_name")
    .in("id", unique);
  if (error) throw new SeedlingError("Could not read seedling names.");
  for (const row of data) names.set(row.id, row.working_name);
  return names;
}
