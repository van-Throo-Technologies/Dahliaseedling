import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  // .claude/ holds local agent tooling, not application code, and its scripts use CommonJS by design.
  globalIgnores([
    ".next/**",
    "coverage/**",
    ".claude/**",
    "next-env.d.ts",
    "src/lib/supabase/database.types.ts",
  ]),
]);
