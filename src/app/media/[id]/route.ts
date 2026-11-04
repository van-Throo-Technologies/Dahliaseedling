import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mediaRow } from "@/modules/capture/repository";
import { isUuid } from "@/modules/capture/validation";

/*
 * Delivers a private original. The media row is read with the caller's session, so RLS decides whether it is
 * visible: its owner, and for a message photograph the two participants in that conversation. Everyone else gets
 * the same 404 as for a missing file.
 * For an owner, the response redirects to a signed URL that expires after 60 seconds. The signed URL lets
 * the browser stream video and seek. Nothing is cached publicly, and no storage path is exposed.
 */

export const dynamic = "force-dynamic";

const SIGNED_URL_SECONDS = 60;

function notFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const supabase = await createSupabaseServerClient();
  const media = await mediaRow(supabase, id);
  if (!media) return notFound();

  const { data, error } = await supabase.storage
    .from("private-media")
    .createSignedUrl(media.storage_path, SIGNED_URL_SECONDS);
  if (error || !data) return notFound();

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.signedUrl,
      "Cache-Control": "private, no-store",
    },
  });
}
