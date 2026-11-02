import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/*
 * Browser Supabase client. It uses only the publishable key, which is public by design, and the
 * visitor's own session cookie. It exists for one purpose in Phase 3: uploading a capture's
 * original file directly to private storage. Every upload is authorised by storage RLS, which allows
 * writes only into the signed-in grower's own folder.
 *
 * The process.env references below must stay literal, so Next.js can inline them into the bundle.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Uploads are not configured on this site.");
  }
  return createBrowserClient<Database>(url, key);
}
