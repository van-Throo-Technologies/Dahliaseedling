"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { isUuid } from "@/modules/capture/validation";
import {
  derivativeItem,
  discard,
  keyOf,
  registerPhoto,
  SeedFailure,
  type DerivativeItem,
} from "./photos";
import { validateInterestQuantity, validateOffer, type OfferForm } from "./validation";

/*
 * Server actions for seeds and seedheads. Each one passes the participation gate, checks its input, and calls the database
 * function as the signed-in grower. The database decides ownership, the image rule, suspension and state. A photograph is
 * uploaded to private storage, registered to the grower, and made into a public derivative before the offer is written,
 * so a failed step leaves no public file referenced.
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function photo(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Where a notice goes back to: the Seedling or the grower's profile. Anything else is refused. */
function safeReturn(value: string): string | null {
  return /^\/(seedlings|profiles)\/[0-9a-f-]{36}$/.test(value) ? value : null;
}

function back(path: string, query: string): never {
  revalidatePath(path.split("?")[0]!);
  redirect(`${path}${path.includes("?") ? "&" : "?"}${query}`);
}

export async function createSeedOfferAction(formData: FormData): Promise<never> {
  const seedlingId = text(formData, "seedlingId");
  const seedlingFrom = seedlingId && isUuid(seedlingId) ? seedlingId : null;
  const { userId } = await requireParticipant("/offers/new");
  // A refused form returns to the form itself; a published offer goes to its source, or to the grower's profile.
  const formPath = seedlingFrom ? `/offers/new?seedling=${seedlingFrom}` : "/offers/new";
  const home = seedlingFrom ? `/seedlings/${seedlingFrom}` : `/profiles/${userId}`;

  const sourcePhoto = photo(formData, "sourcePhoto");
  const parentPhoto = photo(formData, "parentPhoto");
  const form: OfferForm = {
    kind: text(formData, "kind"),
    cultivarName: text(formData, "cultivarName"),
    description: text(formData, "description"),
    material: text(formData, "material"),
    packetSize: text(formData, "packetSize"),
    seedheadCount: text(formData, "seedheadCount"),
    mode: text(formData, "mode"),
    price: text(formData, "price"),
    handover: text(formData, "handover"),
    note: text(formData, "note"),
    hasSourcePhoto: sourcePhoto !== null,
    hasParentPhoto: parentPhoto !== null,
  };
  const checked = validateOffer(form);
  if (!checked.ok) back(formPath, `seedError=${encodeURIComponent(checked.key)}`);
  const input = checked.value;
  if (input.kind === "seedling" && !seedlingFrom)
    back(formPath, `seedError=${encodeURIComponent("seeds.errors.notFound")}`);

  const supabase = await createSupabaseServerClient();
  const privatePaths: string[] = [];
  const publicPaths: string[] = [];
  try {
    const items: DerivativeItem[] = [];
    let sourceId: string;

    if (input.kind === "seedling") {
      const { data, error } = await supabase.rpc("create_seed_source", {
        p_kind: "seedling",
        p_seedling_id: seedlingFrom!,
      });
      if (error || !data) throw new SeedFailure(keyOf(error));
      sourceId = data as string;
    } else if (input.kind === "cultivar") {
      const { data, error } = await supabase.rpc("create_seed_source", {
        p_kind: "cultivar",
        p_cultivar_name: input.cultivarName ?? "",
      });
      if (error || !data) throw new SeedFailure(keyOf(error));
      sourceId = data as string;
      const parent = await registerPhoto(supabase, userId, parentPhoto!, privatePaths);
      const { error: photoError } = await supabase.rpc("set_cultivar_parent_photo", {
        p_source_id: sourceId,
        p_media_id: parent.mediaId,
      });
      if (photoError) throw new SeedFailure(keyOf(photoError));
      items.push(
        await derivativeItem(
          supabase,
          userId,
          parent.path,
          parent.mediaId,
          "parent_image",
          publicPaths,
        ),
      );
    } else if (input.kind === "unidentified") {
      // The photograph is registered before the source is created, so a source never exists without one.
      const source = await registerPhoto(supabase, userId, sourcePhoto!, privatePaths);
      const { data: unidentified, error: createError } = await supabase.rpc(
        "create_unidentified_source",
        {
          p_description: input.description ?? "",
        },
      );
      if (createError || !unidentified) throw new SeedFailure(keyOf(createError));
      const { error: linkError } = await supabase.rpc("add_unidentified_source_photo", {
        p_source_id: unidentified as string,
        p_media_id: source.mediaId,
      });
      if (linkError) throw new SeedFailure(keyOf(linkError));
      const { data, error } = await supabase.rpc("create_seed_source", {
        p_kind: "unidentified",
        p_unidentified_source_id: unidentified as string,
      });
      if (error || !data) throw new SeedFailure(keyOf(error));
      sourceId = data as string;
      items.push(
        await derivativeItem(
          supabase,
          userId,
          source.path,
          source.mediaId,
          "source_photo",
          publicPaths,
        ),
      );
    } else {
      const { data, error } = await supabase.rpc("create_seed_source", { p_kind: "unknown_mixed" });
      if (error || !data) throw new SeedFailure(keyOf(error));
      sourceId = data as string;
    }

    const { error: publishError } = await supabase.rpc("publish_seed_offer", {
      p_source_id: sourceId,
      p_material_type: input.material,
      p_packet_size: input.packetSize ?? undefined,
      p_seedhead_count: input.seedheadCount ?? undefined,
      p_mode: input.mode,
      p_price_text: input.price ?? undefined,
      p_handover_method: input.handover,
      p_note: input.note ?? undefined,
      p_items: items,
    });
    if (publishError) throw new SeedFailure(keyOf(publishError));
  } catch (error) {
    await discard(supabase, publicPaths, "public-media");
    back(
      formPath,
      `seedError=${encodeURIComponent(error instanceof SeedFailure ? error.key : "seeds.errors.generic")}`,
    );
  }
  back(home, "seedNotice=published");
}

async function interestAction(formData: FormData, action: "express" | "withdraw"): Promise<never> {
  const offerId = text(formData, "offerId");
  const returnTo = safeReturn(text(formData, "returnTo"));
  if (!isUuid(offerId) || !returnTo) back("/", "seedError=seeds.errors.notFound");
  await requireParticipant(returnTo);
  const supabase = await createSupabaseServerClient();
  if (action === "withdraw") {
    const { error } = await supabase.rpc("withdraw_seed_offer_interest", { p_offer_id: offerId });
    if (error) back(returnTo, `seedError=${encodeURIComponent(keyOf(error))}`);
    back(returnTo, "seedNotice=interestWithdrawn");
  }
  const quantity = validateInterestQuantity(text(formData, "quantity"));
  if (!quantity.ok) back(returnTo, `seedError=${encodeURIComponent(quantity.key)}`);
  const { error } = await supabase.rpc("express_seed_offer_interest", {
    p_offer_id: offerId,
    p_requested_quantity: quantity.value ?? undefined,
  });
  if (error) back(returnTo, `seedError=${encodeURIComponent(keyOf(error))}`);
  back(returnTo, "seedNotice=interestRecorded");
}

export async function expressSeedInterestAction(formData: FormData): Promise<never> {
  return interestAction(formData, "express");
}

export async function withdrawSeedInterestAction(formData: FormData): Promise<never> {
  return interestAction(formData, "withdraw");
}

export async function closeSeedOfferAction(formData: FormData): Promise<never> {
  const offerId = text(formData, "offerId");
  const returnTo = safeReturn(text(formData, "returnTo"));
  if (!isUuid(offerId) || !returnTo) back("/", "seedError=seeds.errors.notFound");
  await requireParticipant(returnTo);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("close_seed_offer", { p_offer_id: offerId });
  if (error) back(returnTo, `seedError=${encodeURIComponent(keyOf(error))}`);
  back(returnTo, "seedNotice=closed");
}
