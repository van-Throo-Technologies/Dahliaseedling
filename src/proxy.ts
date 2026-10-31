import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next.js 16 proxy (formerly middleware): refreshes the session cookie before a request is handled.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and the health probe, which need no session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
