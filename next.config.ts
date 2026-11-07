import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security/headers";

// One place builds every security header, so the policy can be unit tested. See src/lib/security/headers.ts.
const headers = securityHeaders({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  development: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Avatars are capped at 2 MB (see src/modules/identity/validation.ts). The extra headroom
      // covers multipart boundaries and field metadata.
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    // Pages that show a grower's own data, or depend on their session, are never stored by a browser or a shared cache.
    const personal = [
      "/profile/:path*",
      "/profiles/:path*",
      "/privacy/:path*",
      "/feedback/:path*",
      "/inbox/:path*",
      "/notifications/:path*",
      "/capture/:path*",
      "/observations/:path*",
      // The original photograph address. The preview route sets its own owner-only policy, so it is not listed here.
      "/media/:id",
      "/admin/:path*",
      "/api/account/:path*",
    ].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }));
    return [{ source: "/:path*", headers }, ...personal];
  },
};

export default nextConfig;
