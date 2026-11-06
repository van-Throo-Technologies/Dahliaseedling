import { type NextRequest, NextResponse } from "next/server";
import { publicSurfaceActive, publicSurfaceDecision } from "@/lib/security/public-surface";
import { updateSession } from "@/lib/supabase/session";

/*
 * Next.js 16 proxy (formerly middleware). It runs before any page, action or route handler. On the public surface it refuses every path
 * outside the invitation journey, so no unlisted page, server action or API route can run. On the protected deployment it only refreshes
 * the session cookie.
 *
 * The redirect is built from the request's own URL, which on the platform carries the host the visitor used. A bare relative Location is not
 * accepted in a proxy response.
 */
export async function proxy(request: NextRequest) {
  if (publicSurfaceActive(process.env)) {
    const decision = publicSurfaceDecision(request.nextUrl.pathname);
    if (decision === "home") {
      const response = NextResponse.redirect(new URL("/join", request.url), 307);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    if (decision === "deny") {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  }
  return updateSession(request);
}

export const config = {
  // Skip static assets and the health probe, which need no session. The health probe is allowed on the public surface by its own route.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
