import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Structural guards for the database conventions in README.md ("Database conventions").
 * These check SQL text, not behaviour. Behavioural RLS tests arrive with the first tables (Phase 1).
 */

const SUPABASE_DIR = fileURLToPath(new URL("../../supabase", import.meta.url));
const MIGRATIONS_DIR = join(SUPABASE_DIR, "migrations");

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** Table names created in a migration, without the schema prefix. */
function createdTables(sql: string): string[] {
  const pattern =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:public|private)\.)?("?[a-z_][a-z0-9_]*"?)/gi;
  return [...sql.matchAll(pattern)].flatMap((match) => {
    const name = match[1];
    return name === undefined ? [] : [name.replace(/"/g, "").toLowerCase()];
  });
}

describe("Supabase configuration", () => {
  it("keeps automatic Data API exposure of new tables switched off", () => {
    const config = readFileSync(join(SUPABASE_DIR, "config.toml"), "utf8");
    expect(config).toMatch(/^auto_expose_new_tables\s*=\s*false\s*$/m);
  });
});

describe("migration conventions", () => {
  it("has a version-controlled migrations directory", () => {
    expect(() => readdirSync(MIGRATIONS_DIR)).not.toThrow();
  });

  it("never disables row level security", () => {
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").toLowerCase();
      expect(sql, file).not.toMatch(/disable\s+row\s+level\s+security/);
    }
  });

  it("revokes PUBLIC execute from every new non-trigger function in the migration that creates it", () => {
    // Function defaults do not apply on this platform, so the explicit revoke is the only thing that keeps a new function from
    // being callable by every role. Trigger functions are run by the table, not called, and are exempt.
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").toLowerCase();
      for (const match of sql.matchAll(/create function public\.([a-z_0-9]+)\s*\(/g)) {
        const name = match[1]!;
        const bodyEnd = sql.indexOf("$$;", match.index!);
        const header = sql.slice(match.index!, bodyEnd === -1 ? match.index! + 800 : bodyEnd);
        if (/returns\s+trigger/.test(header)) continue;
        const revoke = new RegExp(
          `revoke\\s[^;]*on\\s+function\\s+public\\.${name}\\s*\\([^)]*\\)[^;]*from[^;]*\\bpublic\\b`,
        );
        expect(sql, `${file}: ${name} must revoke PUBLIC execute`).toMatch(revoke);
      }
    }
  });

  it("enables RLS and grants access in the same migration that creates each table", () => {
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").toLowerCase();

      for (const table of createdTables(sql)) {
        const rlsPattern = new RegExp(
          `alter\\s+table\\s+(?:(?:public|private)\\.)?"?${table}"?\\s+enable\\s+row\\s+level\\s+security`,
        );
        // A table that no client or worker may touch names an explicit revoke of service_role instead of a grant.
        const grantPattern = new RegExp(
          `grant\\s[^;]*\\son\\s+table\\s+(?:(?:public|private)\\.)?"?${table}"?|revoke\\s+all\\s+on\\s+table\\s+(?:(?:public|private)\\.)?"?${table}"?\\s+from\\s[^;]*service_role`,
        );

        expect(sql, `${file}: RLS for ${table}`).toMatch(rlsPattern);
        expect(sql, `${file}: explicit grant for ${table}`).toMatch(grantPattern);
      }
    }
  });
});
