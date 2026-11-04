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
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
