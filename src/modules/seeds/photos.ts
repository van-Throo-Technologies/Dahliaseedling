/*
 * Photographs for seeds and seedheads, shared by offers and by the parentage form. A photograph is uploaded to the
 * grower's private folder and registered to them. It is made into a public derivative only when a live offer or a parent
 * record needs to show it. A failed step never leaves a public file referenced.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makePublicImage } from "@/modules/publications/derivatives";
import { validatePhoto } from "./validation";

export type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DerivativeItem = {
  readonly media_id: string;
  readonly role: "source_photo" | "parent_image";
  readonly derivative_path: string;
  readonly width: number;
  readonly height: number;
  readonly byte_size: number;
};

/** A refusal with a visitor message key. The database text is never shown. */
export class SeedFailure extends Error {
  constructor(readonly key: string) {
    super(key);
  }
}

/** Turns a database error into a visitor message key. */
export function keyOf(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("photograph of the actual source plant"))
    return "seeds.errors.sourcePhotoRequired";
  if (message.includes("photograph of the actual parent plant"))
    return "seeds.errors.parentPhotoRequired";
  if (message.includes("public photograph of the seed parent"))
    return "seeds.errors.needsPublicImage";
  if (message.includes("seed parent must be a public seedling")) return "seeds.errors.notAllowed";
  if (message.includes("must be an image")) return "seeds.errors.photoType";
  if (error?.code === "42501") return "seeds.errors.notAllowed";
  if (error?.code === "P0002") return "seeds.errors.notFound";
  return "seeds.errors.generic";
}

/** Uploads a photograph into the grower's private folder and registers it. Its path is recorded for cleanup. */
export async function registerPhoto(
  supabase: Client,
  userId: string,
  file: File,
  privatePaths: string[],
): Promise<{ readonly mediaId: string; readonly path: string }> {
  const check = validatePhoto({ type: file.type, size: file.size });
  if (!check.ok) throw new SeedFailure(check.key);
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("private-media")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) throw new SeedFailure("seeds.errors.generic");
  privatePaths.push(path);
  const { data, error } = await supabase.rpc("register_source_photo", { p_path: path });
  if (error || !data) throw new SeedFailure(keyOf(error));
  return { mediaId: data as string, path };
}

/** Makes the public derivative of one private photograph, and returns the item the publishing function records. */
export async function derivativeItem(
  supabase: Client,
  userId: string,
  privatePath: string,
  mediaId: string,
  role: "source_photo" | "parent_image",
  publicPaths: string[],
): Promise<DerivativeItem> {
  const { data: blob, error: downloadError } = await supabase.storage
    .from("private-media")
    .download(privatePath);
  if (downloadError || !blob) throw new SeedFailure("seeds.errors.generic");
  const image = await makePublicImage(Buffer.from(await blob.arrayBuffer()));
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("public-media")
    .upload(path, image.data, { contentType: "image/webp", upsert: false });
  if (uploadError) throw new SeedFailure("seeds.errors.generic");
  publicPaths.push(path);
  return {
    media_id: mediaId,
    role,
    derivative_path: path,
    width: image.width,
    height: image.height,
    byte_size: image.data.byteLength,
  };
}

/** Removal is best effort. A file that cannot be removed is never referenced, so it is never shown publicly. */
export async function discard(
  supabase: Client,
  paths: readonly string[],
  bucket: string,
): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage
    .from(bucket)
    .remove([...paths])
    .catch(() => undefined);
}
