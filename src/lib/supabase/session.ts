import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { ConfigError, parseAppConfig } from "@/lib/config/env";
import type { Database } from "./database.types";

/**
 * Refreshes the Supabase session cookies on each request, so a signed-in user is not silently
 * logged out when the access token expires. It does not decide who may see what; that is the
 * job of RLS and the data access layer.
 *
 * If configuration is missing it passes the request through, so public pages keep working
 * (see the Phase 0 health route).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = parseAppConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) return NextResponse.next({ request });
    throw error;
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the session with Supabase Auth; getSession() would trust the cookie alone.
  await supabase.auth.getUser();
  return response;
}
