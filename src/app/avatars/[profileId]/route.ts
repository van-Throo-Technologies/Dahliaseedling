import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AVATAR_MIME_TYPES } from "@/modules/identity/validation";

/*
 * Serves a profile's current avatar. The avatars bucket is private, so this route is the only
 * application path to an avatar.
 *
 * Each request runs as the caller's own session. The profile is read first: RLS returns nothing
 * for a suspended or missing profile, and then no storage path is used at all. The file is read
 * with the same session, so the storage policy applies too. Nothing is cached publicly, so a
 * suspension takes effect on the next request.
 */

// Profile ids are UUIDs. Anything else is not a profile.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ profileId: string }> },
): Promise<Response> {
  const { profileId } = await params;
  if (!UUID_PATTERN.test(profileId)) return notFound();

  const supabase = await createSupabaseServerClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile?.avatar_path) return notFound();

  const { data: file, error: fileError } = await supabase.storage
    .from("avatars")
    .download(profile.avatar_path);
  if (fileError || !file) return notFound();

  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) return notFound();

  return new Response(file, {
    headers: {
      "Content-Type": file.type,
      // Revalidate every time: a suspension must take effect immediately.
      "Cache-Control": "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
