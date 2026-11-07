import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mediaRow } from "@/modules/capture/repository";
import { isHeifMime } from "@/modules/capture/media-type";
import { isUuid } from "@/modules/capture/validation";
import { makePublicImage } from "@/modules/publications/derivatives";

/*
 * A preview of a private HEIC or HEIF photograph, for its owner. The row is read with the caller's own session, so RLS decides who can
 * see it, exactly as for the original. Anyone else, and anyone signed out, gets the same 404 as for a missing file. Only HEIC and HEIF
 * have this route. Other photographs keep their own address.
 *
 * The preview is built by the same pipeline as a public copy: decoded, turned upright, resized to the public long edge, and written as
 * WebP with no metadata. Nothing is kept on the server. The response is cached only by the owner's own browser (private), and the
 * ETag comes from the stored path, so a repeat request is answered without decoding again. The browser must revalidate with the
 * owner's session, so a shared device cannot show one account's preview to another.
 */

export const dynamic = "force-dynamic";

function notFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const supabase = await createSupabaseServerClient();
  const media = await mediaRow(supabase, id);
  if (!media || !isHeifMime(media.mime_type)) return notFound();

  // The ETag names the media row and its stored path. Both are fixed when the photograph is saved, so the tag changes only with the photograph.
  const etag = `"${createHash("sha256").update(`${media.id}|${media.storage_path}|preview-v1`).digest("hex")}"`;
  const headers = {
    "Cache-Control": "private, no-cache",
    ETag: etag,
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const { data: blob, error } = await supabase.storage
    .from("private-media")
    .download(media.storage_path);
  if (error || !blob) return notFound();

  try {
    const image = await makePublicImage(Buffer.from(await blob.arrayBuffer()), media.mime_type);
    return new Response(new Uint8Array(image.data), {
      status: 200,
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    // The photograph could not be decoded or is larger than the limit. The page says so; nothing is stored or published.
    return new Response(null, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  }
}
