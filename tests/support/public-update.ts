import { vi } from "vitest";
import sharp from "sharp";
// The derivative module is server-only in the app. Test runs live outside React's server runtime, as in its unit test.
vi.mock("server-only", () => ({}));
import type { TestUser } from "./local-supabase";
import { makePublicImage } from "../../src/modules/publications/derivatives";

/*
 * Test fixture for a public Seedling image. It performs the same steps the application performs, in order, with the
 * grower's own session: a photo is captured into a Seedling through capture_observation (Phase 3), its public derivative
 * is made with the production derivative module and uploaded to public-media, and the Update is published through
 * publish_update (Phase 4). Nothing is inserted directly. A Phase 7 test that needs a public Seedling image uses this.
 */

export interface CapturedPhoto {
  readonly observationId: string;
  readonly mediaId: string;
  readonly originalPath: string;
}

export interface PublishedImage {
  readonly updateId: string;
  readonly derivativePath: string;
}

export async function capturePhoto(holder: TestUser, seedlingId: string): Promise<CapturedPhoto> {
  const jpeg = await sharp({
    create: { width: 900, height: 600, channels: 3, background: "rgb(192,80,128)" },
  })
    .jpeg()
    .toBuffer();
  const originalPath = `${holder.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await holder.client.storage
    .from("private-media")
    .upload(originalPath, jpeg, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw new Error(`capture upload failed: ${uploadError.message}`);

  const { data, error } = await holder.client.rpc("capture_observation", {
    p_seedling_id: seedlingId,
    p_note: "Fixture capture",
    p_paths: [originalPath],
  });
  if (error) throw new Error(`capture failed: ${error.message}`);
  const observationId = (data as { id: string }).id;

  const { data: links, error: linkError } = await holder.client
    .from("observation_media")
    .select("media_id")
    .eq("observation_id", observationId);
  if (linkError || !links?.[0]) throw new Error("the captured photo was not linked");
  return { observationId, mediaId: links[0].media_id as string, originalPath };
}

export async function publishPublicImage(
  holder: TestUser,
  photo: CapturedPhoto,
): Promise<PublishedImage> {
  const { data: blob, error: downloadError } = await holder.client.storage
    .from("private-media")
    .download(photo.originalPath);
  if (downloadError || !blob) throw new Error("the original could not be read by its owner");
  const image = await makePublicImage(Buffer.from(await blob.arrayBuffer()));

  const derivativePath = `${holder.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await holder.client.storage
    .from("public-media")
    .upload(derivativePath, image.data, { contentType: "image/webp", upsert: false });
  if (uploadError) throw new Error(`derivative upload failed: ${uploadError.message}`);

  const { data, error } = await holder.client.rpc("publish_update", {
    p_observation_id: photo.observationId,
    p_client_key: crypto.randomUUID(),
    p_caption: "Fixture update",
    p_items: [
      {
        media_id: photo.mediaId,
        derivative_path: derivativePath,
        width: image.width,
        height: image.height,
        byte_size: image.data.byteLength,
      },
    ],
  });
  if (error) throw new Error(`publish failed: ${error.message}`);
  return { updateId: (data as { id: string }).id, derivativePath };
}
