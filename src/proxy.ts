import { type NextRequest, NextResponse } from "next/server";
import {
  STAGING_GATE_COOKIE,
  STAGING_GATE_LOGIN_PATH,
  stagingDecision,
  stagingGate,
} from "@/lib/security/staging-gate";
import { publicSurfaceActive, publicSurfaceDecision } from "@/lib/security/public-surface";
import { updateSession } from "@/lib/supabase/session";

/*
 * Next.js 16 proxy (formerly middleware). It runs before any page, action or route handler. First, when the staging testing gate is on,
 * every path needs the gate's session cookie, except the gate's own login page and static files. Then, on the public surface, it refuses
 * every path outside the invitation journey, so no unlisted page, server action or API route can run. Otherwise it only refreshes the
 * session cookie.
 *
 * The redirect is built from the request's own URL, which on the platform carries the host the visitor used. A bare relative Location is not
 * accepted in a proxy response.
 */
export async function proxy(request: NextRequest) {
  const gateDecision = stagingDecision(
    stagingGate(process.env),
    request.nextUrl.pathname,
    request.cookies.get(STAGING_GATE_COOKIE)?.value,
    Math.floor(Date.now() / 1000),
  );
  if (gateDecision === "unavailable") {
    return new NextResponse(null, {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (gateDecision === "login") {
    const headers = { "Cache-Control": "private, no-store" };
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return new NextResponse(null, { status: 401, headers });
    }
    const login = new URL(STAGING_GATE_LOGIN_PATH, request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(login, 307);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

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
