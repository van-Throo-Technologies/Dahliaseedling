import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";

/*
 * Test-only access to the local Supabase stack. Values come from `supabase status`, so no key is
 * written to disk. These helpers must never run against a hosted project: they use the secret key
 * and a superuser database connection.
 */

export interface LocalSupabase {
  readonly apiUrl: string;
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly dbUrl: string;
}

let cached: LocalSupabase | undefined;

export function localSupabase(): LocalSupabase {
  if (cached) return cached;

  let output: string;
  try {
    output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npm run supabase:start`.");
  }

  const values = new Map<string, string>();
  for (const line of output.split("\n")) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1], match[2].replace(/^"|"$/g, ""));
    }
  }

  const apiUrl = values.get("API_URL");
  const publishableKey = values.get("PUBLISHABLE_KEY");
  const secretKey = values.get("SECRET_KEY");
  const dbUrl = values.get("DB_URL");
  if (!apiUrl || !publishableKey || !secretKey || !dbUrl) {
    throw new Error("`supabase status` did not report the expected local values.");
  }

  cached = { apiUrl, publishableKey, secretKey, dbUrl };
  return cached;
}

/** A client with no session: what a visitor sees. */
export function anonClient(): SupabaseClient {
  const { apiUrl, publishableKey } = localSupabase();
  return createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly client: SupabaseClient;
}

/** Creates a real auth user through the public sign-up API and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const client = anonClient();
  const email = `rls-${label}-${crypto.randomUUID()}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: "correct-horse-battery" });
  if (error || !data.user)
    throw new Error(`Could not create test user ${label}: ${error?.message}`);
  if (!data.session) throw new Error("Email confirmation must be disabled for local tests.");
  return { id: data.user.id, email, client };
}

/** Runs a query as the database superuser. Tests use it to check state and to grant admin. */
export async function withSuperuser<T>(run: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: localSupabase().dbUrl });
  await db.connect();
  try {
    return await run(db);
  } finally {
    await db.end();
  }
}

/** Removes every auth user this suite created. Their profiles and admin rows cascade. */
export async function removeTestUsers(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await withSuperuser((db) => db.query("delete from auth.users where id = any($1::uuid[])", [ids]));
}

/** PostgREST / Postgres error code from a supabase-js error, or null when there was none. */
export function errorCode(error: { code?: string } | null): string | null {
  return error?.code ?? null;
}
