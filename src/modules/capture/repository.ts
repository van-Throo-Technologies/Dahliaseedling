import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MediaKind } from "./limits";
import type { MessageKey, Values } from "@/i18n/translator";
import { mapDatabaseMessage } from "@/i18n/database-messages";

/*
 * Observation and media data access. Every call runs with the caller's own session, so RLS decides
 * what is visible: an observation is readable only by its author, and media only by its owner.
 * Writes go through the domain functions.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ObservationRow = Database["public"]["Tables"]["observations"]["Row"];
type MediaRow = Database["public"]["Tables"]["media"]["Row"];

/** A failure the interface can show. It carries a message key and its values, never a sentence. */
export class CaptureError extends Error {
  readonly key: MessageKey;
  readonly values?: Values;

  constructor(key: MessageKey, values?: Values) {
    super(key);
    this.key = key;
    this.values = values;
  }
}

/** A database failure as a key: a known sentence is translated, anything else becomes the fallback key. */
function captureFailure(error: { message?: string } | null, fallback: MessageKey): CaptureError {
  const mapped = mapDatabaseMessage(error?.message);
  return mapped ? new CaptureError(mapped.key, mapped.values) : new CaptureError(fallback);
}

/**
 * A read that the database refuses with a permission error means "not visible to this reader". Visitors have
 * no grant on observations or media at all, so for them the answer is always "nothing", not a failure.
 */
function refusedByPolicy(error: { code?: string } | null): boolean {
  return error?.code === "42501";
}

export interface Observation {
  readonly id: string;
  readonly seedlingId: string;
  readonly authorId: string;
  readonly observedAt: string;
  readonly note: string | null;
  readonly voiceTranscript: string | null;
  readonly createdAt: string;
}

export interface MediaItem {
  readonly id: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly sortOrder: number;
}

const OBSERVATION_COLUMNS =
  "id, seedling_id, author_id, observed_at, note, voice_transcript, created_at";

function toObservation(
  row: Pick<
    ObservationRow,
    "id" | "seedling_id" | "author_id" | "observed_at" | "note" | "voice_transcript" | "created_at"
  >,
): Observation {
  return {
    id: row.id,
    seedlingId: row.seedling_id,
    authorId: row.author_id,
    observedAt: row.observed_at,
    note: row.note,
    voiceTranscript: row.voice_transcript,
    createdAt: row.created_at,
  };
}

export interface CaptureInput {
  readonly seedlingId: string | null;
  readonly newSeedling: boolean;
  readonly observedAt: string | null;
  readonly note: string | null;
  readonly voiceTranscript: string | null;
  readonly paths: readonly string[];
}

export async function captureObservation(
  client: Client,
  input: CaptureInput,
): Promise<Observation> {
  const { data, error } = await client.rpc("capture_observation", {
    p_seedling_id: input.seedlingId ?? undefined,
    p_new_seedling: input.newSeedling,
    p_observed_at: input.observedAt ?? undefined,
    p_note: input.note ?? undefined,
    p_voice_transcript: input.voiceTranscript ?? undefined,
    p_paths: [...input.paths],
  });
  if (error || !data) throw captureFailure(error, "errors.capture.captureFailed");
  return toObservation(data);
}

export async function moveObservation(
  client: Client,
  observationId: string,
  target: { readonly seedlingId: string | null; readonly newSeedling: boolean },
): Promise<Observation> {
  const { data, error } = await client.rpc("move_observation", {
    p_observation_id: observationId,
    p_target_seedling_id: target.seedlingId ?? undefined,
    p_new_seedling: target.newSeedling,
  });
  if (error || !data) throw captureFailure(error, "errors.capture.notMoved");
  return toObservation(data);
}

export async function deleteObservation(client: Client, observationId: string): Promise<void> {
  const { error } = await client.rpc("delete_observation", { p_observation_id: observationId });
  if (error) throw captureFailure(error, "errors.unexpected");
}

/** Changes the note and/or the observed time. Returns false when RLS allowed no change (not the author, or suspended). */
export async function updateObservationText(
  client: Client,
  observationId: string,
  patch: { readonly note: string | null; readonly observedAt: string | null },
): Promise<boolean> {
  const update: { note: string | null; observed_at?: string } = { note: patch.note };
  if (patch.observedAt) update.observed_at = patch.observedAt;
  const { data, error } = await client
    .from("observations")
    .update(update)
    .eq("id", observationId)
    .select("id");
  if (error) throw new CaptureError("errors.capture.notSaved");
  return data.length > 0;
}

export async function getObservation(
  client: Client,
  observationId: string,
): Promise<Observation | null> {
  const { data, error } = await client
    .from("observations")
    .select(OBSERVATION_COLUMNS)
    .eq("id", observationId)
    .maybeSingle();
  if (refusedByPolicy(error)) return null;
  if (error) throw new CaptureError("errors.readFailed");
  return data ? toObservation(data) : null;
}

/** The author's own live observations on one seedling, newest first. Other readers receive none. */
export async function listObservationsForSeedling(
  client: Client,
  seedlingId: string,
): Promise<Observation[]> {
  const { data, error } = await client
    .from("observations")
    .select(OBSERVATION_COLUMNS)
    .eq("seedling_id", seedlingId)
    .order("observed_at", { ascending: false });
  if (refusedByPolicy(error)) return [];
  if (error) throw new CaptureError("errors.readFailed");
  return data.map(toObservation);
}

export async function mediaFor(
  client: Client,
  observationIds: readonly string[],
): Promise<Map<string, MediaItem[]>> {
  const result = new Map<string, MediaItem[]>();
  if (observationIds.length === 0) return result;
  const { data: links, error: linkError } = await client
    .from("observation_media")
    .select("observation_id, media_id, sort_order")
    .in("observation_id", [...observationIds]);
  if (refusedByPolicy(linkError)) return result;
  if (linkError) throw new CaptureError("errors.capture.readFailed");
  if (links.length === 0) return result;

  const { data: media, error: mediaError } = await client
    .from("media")
    .select("id, kind, mime_type, byte_size")
    .in("id", [...new Set(links.map((link) => link.media_id))]);
  if (refusedByPolicy(mediaError)) return result;
  if (mediaError) throw new CaptureError("errors.capture.readFailed");
  const byId = new Map(media.map((row) => [row.id, row] as const));

  for (const link of [...links].sort((a, b) => a.sort_order - b.sort_order)) {
    const row = byId.get(link.media_id);
    if (!row) continue;
    const item: MediaItem = {
      id: row.id,
      kind: row.kind,
      mimeType: row.mime_type,
      byteSize: Number(row.byte_size),
      sortOrder: link.sort_order,
    };
    result.set(link.observation_id, [...(result.get(link.observation_id) ?? []), item]);
  }
  return result;
}

/** A single media row the reader may see, used by the delivery route. */
export async function mediaRow(
  client: Client,
  mediaId: string,
): Promise<Pick<MediaRow, "id" | "storage_path" | "mime_type"> | null> {
  const { data, error } = await client
    .from("media")
    .select("id, storage_path, mime_type")
    .eq("id", mediaId)
    .maybeSingle();
  if (refusedByPolicy(error)) return null;
  if (error) throw new CaptureError("errors.capture.readFailed");
  return data;
}

/** Removes uploads that never became media (a cancelled or failed capture). RLS refuses registered media. */
export async function discardUploads(client: Client, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  await client.storage.from("private-media").remove([...paths]);
}
