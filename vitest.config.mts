import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit and repository-guard tests. They need no running services.
// Database (RLS) tests use vitest.db.config.mts; browser tests use Playwright.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "tests/design-system/**/*.test.ts",
      "tests/supabase/**/*.test.ts",
    ],
  },
});
