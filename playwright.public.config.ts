import { defineConfig } from "@playwright/test";
import { localSupabase } from "./tests/support/local-supabase";
import { intakeSecret } from "./tests/support/invitation-intake";

// Workers and the test server read the same intake key, so it is set on the process before anything else runs.
process.env.INVITATION_INTAKE_SECRET = intakeSecret;

// Checks the public deployment's surface: only the invitation journey is served. Run after a build: `npm run test:e2e:public`.
// It uses its own server, with PUBLIC_SURFACE switched on and a small hourly allowance, so the visitor limit can be reached.
const PORT = 3200;
const supabase = localSupabase();

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/support/e2e-intake.setup.ts",
  testMatch: "public-surface.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  },
  // Chromium with the phone viewport, touch and pixel ratio from the top-level use block. The device profile itself is not used, because it selects WebKit.
  projects: [{ name: "public-phone" }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabase.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      NEXT_TELEMETRY_DISABLED: "1",
      PUBLIC_SURFACE: "invitations",
      INVITATION_REQUESTS_ENABLED: "true",
      INVITATION_VISITOR_SALT: crypto.randomUUID(),
      INVITATION_INTAKE_SECRET: intakeSecret,
      INVITATION_VISITOR_HOURLY_LIMIT: "3",
    } as Record<string, string>,
  },
});
