/*
 * Input checks for seed and seedhead offers. These run before any database call, so a refused form never creates a
 * source record or uploads a file. The database repeats the rules that matter (source state, photographs, quantities,
 * ownership), so these checks are for clear messages, not for security.
 */

export const SOURCE_KINDS = ["seedling", "cultivar", "unidentified", "unknown_mixed"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const MATERIALS = ["loose_seeds", "seedheads"] as const;
export type Material = (typeof MATERIALS)[number];
export const MODES = ["free", "for_sale", "trade"] as const;
export type Mode = (typeof MODES)[number];
export const HANDOVERS = ["pickup", "shipping", "both"] as const;
export type Handover = (typeof HANDOVERS)[number];

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_BYTES = 2.5 * 1024 * 1024;
export const QUANTITY_MAX = 500;

export type Checked<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly key: string };

const ok = <T>(value: T): Checked<T> => ({ ok: true, value });
const fail = (key: string): { readonly ok: false; readonly key: string } => ({ ok: false, key });

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function whole(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return number >= 1 && number <= QUANTITY_MAX ? number : null;
}

export interface OfferForm {
  readonly kind: unknown;
  readonly cultivarName: unknown;
  readonly description: unknown;
  readonly material: unknown;
  readonly packetSize: unknown;
  readonly seedheadCount: unknown;
  readonly mode: unknown;
  readonly price: unknown;
  readonly handover: unknown;
  readonly note: unknown;
  /** Whether the form carries a photograph of the source plant, and of the actual parent plant. */
  readonly hasSourcePhoto: boolean;
  readonly hasParentPhoto: boolean;
}

export interface OfferInput {
  readonly kind: SourceKind;
  readonly cultivarName: string | null;
  readonly description: string | null;
  readonly material: Material;
  readonly packetSize: number | null;
  readonly seedheadCount: number | null;
  readonly mode: Mode;
  readonly price: string | null;
  readonly handover: Handover;
  readonly note: string | null;
}

export function validateOffer(form: OfferForm): Checked<OfferInput> {
  const kind = oneOf(form.kind, SOURCE_KINDS);
  if (!kind) return fail("seeds.errors.sourceRequired");

  let cultivarName: string | null = null;
  if (kind === "cultivar") {
    const name = clean(form.cultivarName);
    if (name.length < 2 || name.length > 80) return fail("seeds.errors.cultivarName");
    if (!form.hasParentPhoto) return fail("seeds.errors.parentPhotoRequired");
    cultivarName = name;
  }

  let description: string | null = null;
  if (kind === "unidentified") {
    if (!form.hasSourcePhoto) return fail("seeds.errors.sourcePhotoRequired");
    description = clean(form.description) || null;
    if (description && description.length > 280) return fail("seeds.errors.description");
  }

  const material = oneOf(form.material, MATERIALS);
  if (!material) return fail("seeds.errors.material");
  let packetSize: number | null = null;
  let seedheadCount: number | null = null;
  if (material === "loose_seeds") {
    packetSize = whole(form.packetSize);
    if (packetSize === null) return fail("seeds.errors.packetSize");
  } else {
    seedheadCount = whole(form.seedheadCount);
    if (seedheadCount === null) return fail("seeds.errors.seedheadCount");
  }

  const mode = oneOf(form.mode, MODES);
  if (!mode) return fail("seeds.errors.mode");
  const price = clean(form.price) || null;
  if (price && (mode !== "for_sale" || price.length > 80)) return fail("seeds.errors.price");

  const handover = oneOf(form.handover, HANDOVERS);
  if (!handover) return fail("seeds.errors.handover");

  const note = clean(form.note) || null;
  if (note && note.length > 280) return fail("seeds.errors.note");

  return ok({
    kind,
    cultivarName,
    description,
    material,
    packetSize,
    seedheadCount,
    mode,
    price,
    handover,
    note,
  });
}

/** A photograph is a JPEG, PNG or WebP no larger than the limit. Anything else is refused before upload. */
export function validatePhoto(file: {
  readonly type: string;
  readonly size: number;
}): Checked<true> {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type))
    return fail("seeds.errors.photoType");
  if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) return fail("seeds.errors.photoSize");
  return ok(true);
}

/** A grower's note on an interest: how many, if they say. It is structured context only, not a conversation. */
export function validateInterestQuantity(value: unknown): Checked<string | null> {
  const quantity = clean(value);
  if (quantity.length > 80) return fail("seeds.errors.quantity");
  return ok(quantity || null);
}
