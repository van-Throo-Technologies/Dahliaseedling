import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseAppConfig } from "@/lib/config/env";
import type { Database } from "./database.types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * It uses the publishable key and the visitor's own session cookies, so every query runs as that
 * user and is checked by RLS. It never uses the secret key. The "server-only" import keeps this
 * module out of any client bundle.
 */
export async function createSupabaseServerClient() {
  const config = parseAppConfig(process.env);
  const cookieStore = await cookies();

  return createServerClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
