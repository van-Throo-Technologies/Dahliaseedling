import { defineConfig, devices } from "@playwright/test";
import { localSupabase } from "./tests/support/local-supabase";
import { intakeSecret } from "./tests/support/invitation-intake";

// Workers and the test server read the same intake key, so it is set on the process before anything else runs.
process.env.INVITATION_INTAKE_SECRET = intakeSecret;

// End-to-end tests run against a production build wired to the local Supabase stack.
// Start the stack first: `npm run supabase:start`.
const PORT = 3100;
const supabase = localSupabase();

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/support/e2e-intake.setup.ts",
  // Tests create real accounts in the shared local database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  // The public-surface checks run against their own server (playwright.public.config.ts).
  testIgnore: ["**/public-surface.spec.ts"],
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
      // The invitation-request page is off by default. The browser tests turn it on, so the public journey can be exercised.
      INVITATION_REQUESTS_ENABLED: "true",
      // A fresh salt per run keeps the visitor counts of one run from affecting another. The allowance is high because every test shares one address.
      INVITATION_VISITOR_SALT: crypto.randomUUID(),
      INVITATION_INTAKE_SECRET: intakeSecret,
      INVITATION_VISITOR_HOURLY_LIMIT: "1000",
    } as Record<string, string>,
  },
});
