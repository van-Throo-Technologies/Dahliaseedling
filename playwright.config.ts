import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./tests/support/local-supabase";

// End-to-end tests run against a production build wired to the local Supabase stack.
// Start the stack first: `npm run supabase:start`.
const PORT = 3100;
const supabase = localSupabase();

export default defineConfig({
  testDir: "tests/e2e",
  // Tests create real accounts in the shared local database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Phone is the primary environment (390 px, touch, safe-area aware).
      name: "phone",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      // Desktop checks that the same information architecture adapts without breaking.
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabase.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      NEXT_TELEMETRY_DISABLED: "1",
    } as Record<string, string>,
  },
});
