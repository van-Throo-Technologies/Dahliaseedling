import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { parseAppConfig } from "@/lib/config/env";
import { logEvent } from "@/lib/logging/log";
import type { Database } from "@/lib/supabase/database.types";
import {
  confirmFailureFrom,
  confirmTypeFrom,
  destinationAfterConfirm,
  type ConfirmFailure,
  type ConfirmType,
  tokenHashFrom,
} from "@/modules/identity/auth-flow";
import { findProfile } from "@/modules/identity/profile-repository";
import { RESET_COOKIE, resetCookieOptions } from "@/modules/identity/password-reset";

/*
 * Confirms a sign-up or accepts an invitation. The email link carries a one-time token hash, which this route exchanges for a session
 * on the server. Nothing from the link is logged, and the token is never echoed back. The session cookies are written to the redirect
 * response, so the next request is already signed in. Failures redirect to sign-in with a short code, which the page turns into text.
 */

export const dynamic = "force-dynamic";

const NO_STORE = "private, no-store";

interface PendingCookie {
  readonly name: string;
  readonly value: string;
  readonly options?: Parameters<NextResponse["cookies"]["set"]>[2];
}

/*
 * The Location header is a path, not an absolute URL. An absolute URL is built from the server's own host name, which need not be the
 * host the visitor used. The browser then sends the session cookie to a different origin and the visitor is not signed in. A path
 * resolves against the origin the visitor actually used, and it can only ever point at this site.
 */
function redirectTo(
  path: string,
  response = new NextResponse(null, { status: 303 }),
): NextResponse {
  response.headers.set("Location", path);
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

function refuse(failure: ConfirmFailure, type: ConfirmType | null): NextResponse {
  logEvent("warn", "auth_confirm", { outcome: "refused", code: failure, route: "auth.confirm" });
  // A recovery link that fails goes back to the forgot-password page, which says why. Other links keep their sign-in notice.
  if (type === "recovery") return redirectTo(`/forgot-password?link=${failure}`);
  return redirectTo(`/sign-in?confirm=${failure}`);
}

export async function GET(request: NextRequest): Promise<Response> {
  const type = confirmTypeFrom(request.nextUrl.searchParams.get("type"));
  const tokenHash = tokenHashFrom(request.nextUrl.searchParams.get("token_hash"));
  if (!type || !tokenHash) return refuse("invalid", type);

  const config = parseAppConfig(process.env);
  const pending: PendingCookie[] = [];
  const supabase = createServerClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) pending.push({ name, value, options });
      },
    },
  });

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return refuse(confirmFailureFrom(error?.code), type);

  const profile = await findProfile(supabase, data.user.id);
  const destination = destinationAfterConfirm({
    type,
    next: request.nextUrl.searchParams.get("next"),
    hasProfile: profile !== null,
  });

  logEvent("info", "auth_confirm", { outcome: "confirmed", code: type, route: "auth.confirm" });
  const response = redirectTo(destination);
  for (const { name, value, options } of pending) response.cookies.set(name, value, options);
  if (type === "recovery") response.cookies.set(RESET_COOKIE, "1", resetCookieOptions);
  return response;
}
