import type { Client } from "./photos";
import { keyOf, registerPhoto, SeedFailure } from "./photos";

/*
 * Records an unidentified dahlia as a parent of a Seedling. The grower either reuses an unidentified source they already
 * own, or adds a new one with a photograph of the actual plant. The database is the final authority: it requires the
 * caller to hold the Seedling, to own the source, and the source to have a photograph. No cultivar and no Seedling is
 * created here.
 */
export async function recordUnidentifiedParent(
  supabase: Client,
  userId: string,
  seedlingId: string,
  role: "seed_parent" | "pollen_parent",
  input: {
    readonly unidentifiedSourceId: string | null;
    readonly unidentifiedDescription: string | null;
    readonly notes: string | null;
  },
  photo: File | null,
): Promise<void> {
  let sourceId = input.unidentifiedSourceId;
  if (!sourceId) {
    // The photograph is registered before the source exists, so a new source never lacks one.
    if (!photo) throw new SeedFailure("seeds.errors.sourcePhotoRequired");
    const privatePaths: string[] = [];
    const registered = await registerPhoto(supabase, userId, photo, privatePaths);
    const { data: created, error: createError } = await supabase.rpc("create_unidentified_source", {
      p_description: input.unidentifiedDescription ?? "",
    });
    if (createError || !created) throw new SeedFailure(keyOf(createError));
    sourceId = created as string;
    const { error: linkError } = await supabase.rpc("add_unidentified_source_photo", {
      p_source_id: sourceId,
      p_media_id: registered.mediaId,
    });
    if (linkError) throw new SeedFailure(keyOf(linkError));
  }
  const { error } = await supabase.rpc("set_seedling_parent_unidentified", {
    p_seedling_id: seedlingId,
    p_role: role,
    p_source_id: sourceId,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw new SeedFailure(keyOf(error));
}
