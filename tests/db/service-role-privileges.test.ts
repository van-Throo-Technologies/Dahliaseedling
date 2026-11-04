import { describe, expect, it } from "vitest";
import { withSuperuser } from "../support/local-supabase";

/*
 * Least privilege for the email worker's credential. The credential is the Supabase service role, which bypasses row-level
 * security. These tests therefore do not ask the catalog whether it "should" have access. They attempt each prohibited operation
 * as that role inside a transaction that is always rolled back, so a regression would fail here without changing any data.
 */

const EMAIL_FUNCTIONS = [
  "email_claim_due(integer,integer)",
  "email_delivery_context(uuid,uuid)",
  "email_record_failed(uuid,uuid,text)",
  "email_record_retry(uuid,uuid,text)",
  "email_record_sent(uuid,uuid,text)",
];

const REPRESENTATIVE_TABLES = [
  "profiles",
  "seedlings",
  "observations",
  "messages",
  "conversations",
  "reports",
  "admin_users",
  "rehome_cases",
  "seed_offers",
  "seed_sources",
  "notifications",
  "email_outbox",
  "blocks",
  "comments",
  "updates",
  "media",
  "availability_subscriptions",
];

const SENSITIVE_CALLS: [string, string][] = [
  ["resolve_report", "select public.resolve_report(gen_random_uuid(), 'dismissed', null)"],
  ["admin_remove_content", "select public.admin_remove_content(gen_random_uuid(), null)"],
  [
    "admin_set_reported_suspension",
    "select public.admin_set_reported_suspension(gen_random_uuid(), true, null)",
  ],
  ["admin_list_reports", "select * from public.admin_list_reports(true, 1)"],
  ["create_report", "select public.create_report('update', gen_random_uuid(), 'spam', null)"],
  ["subscribe_availability", "select public.subscribe_availability(gen_random_uuid(), 'en')"],
  ["block_user", "select public.block_user(gen_random_uuid())"],
  ["send_message", "select public.send_message(gen_random_uuid(), gen_random_uuid(), 'x', null)"],
  ["register_message_photo", "select public.register_message_photo('x')"],
];

/**
 * Runs one statement as the service role inside a transaction that is always rolled back. Returns the PostgreSQL error code, or
 * null when the statement succeeded. A successful prohibited statement is undone by the rollback, so the test never leaves data
 * behind even when it fails.
 */
async function attemptAsServiceRole(sql: string): Promise<string | null> {
  return withSuperuser(async (db) => {
    await db.query("begin");
    await db.query("set local role service_role");
    try {
      await db.query(sql);
      return null;
    } catch (error) {
      return (error as { code?: string }).code ?? "unknown";
    } finally {
      await db.query("rollback");
    }
  });
}

async function catalog(sql: string): Promise<string[]> {
  return withSuperuser(async (db) =>
    (await db.query(sql)).rows.map((r: { name: string }) => r.name),
  );
}

describe("the effective table privileges of the service role", () => {
  it("holds no table privilege on any application table, checked against the catalog for every privilege", async () => {
    const held = await catalog(`
      select c.relname as name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and (has_table_privilege('service_role', c.oid, 'select')
           or has_table_privilege('service_role', c.oid, 'insert')
           or has_table_privilege('service_role', c.oid, 'update')
           or has_table_privilege('service_role', c.oid, 'delete')
           or has_table_privilege('service_role', c.oid, 'truncate')
           or has_table_privilege('service_role', c.oid, 'references')
           or has_table_privilege('service_role', c.oid, 'trigger')
           or has_table_privilege('service_role', c.oid, 'maintain'))
       order by 1`);
    expect(held).toEqual([]);
  });

  it.each(REPRESENTATIVE_TABLES)("cannot TRUNCATE public.%s", async (table) => {
    expect(await attemptAsServiceRole(`truncate table public.${table}`)).toBe("42501");
  });

  it.each(REPRESENTATIVE_TABLES)("cannot read public.%s", async (table) => {
    expect(await attemptAsServiceRole(`select 1 from public.${table} limit 1`)).toBe("42501");
  });

  it.each(REPRESENTATIVE_TABLES)("cannot insert into public.%s", async (table) => {
    expect(await attemptAsServiceRole(`insert into public.${table} default values`)).toBe("42501");
  });

  it("cannot update or delete application rows", async () => {
    expect(
      await attemptAsServiceRole(
        "update public.profiles set display_name = display_name where false",
      ),
    ).toBe("42501");
    expect(await attemptAsServiceRole("delete from public.profiles where false")).toBe("42501");
    expect(await attemptAsServiceRole("delete from public.email_outbox where false")).toBe("42501");
  });
});

describe("the functions the service role may execute", () => {
  it("executes exactly the five email-delivery functions in the application schema, by exact signature", async () => {
    const executable = await catalog(`
      select regexp_replace(replace(p.oid::regprocedure::text, ' ', ''), '^public\\.', '') as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('service_role', p.oid, 'execute')
       order by 1`);
    expect(executable).toEqual([...EMAIL_FUNCTIONS].sort());
  });

  it("can call each email-delivery function; each answers with its own result, not a permission error", async () => {
    expect(await attemptAsServiceRole("select * from public.email_claim_due(1, 300)")).toBeNull();
    expect(
      await attemptAsServiceRole(
        "select * from public.email_delivery_context(gen_random_uuid(), gen_random_uuid())",
      ),
    ).toBe("P0002");
    expect(
      await attemptAsServiceRole(
        "select public.email_record_sent(gen_random_uuid(), gen_random_uuid(), 'x')",
      ),
    ).toBe("P0002");
    expect(
      await attemptAsServiceRole(
        "select public.email_record_retry(gen_random_uuid(), gen_random_uuid(), 'provider_temporary')",
      ),
    ).toBe("P0002");
    expect(
      await attemptAsServiceRole(
        "select public.email_record_failed(gen_random_uuid(), gen_random_uuid(), 'provider_rejected')",
      ),
    ).toBe("P0002");
  });

  it.each(SENSITIVE_CALLS)("cannot execute %s", async (_name, sql) => {
    expect(await attemptAsServiceRole(sql)).toBe("42501");
  });
});

describe("anonymous and signed-in clients keep what they need", () => {
  it("neither anon nor authenticated holds TRUNCATE, REFERENCES, TRIGGER or MAINTAIN on any application table", async () => {
    const held = await catalog(`
      select c.relname || ':' || r.role as name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join (values ('anon'), ('authenticated')) as r(role)
       where n.nspname = 'public' and c.relkind = 'r'
         and (has_table_privilege(r.role, c.oid, 'truncate')
           or has_table_privilege(r.role, c.oid, 'references')
           or has_table_privilege(r.role, c.oid, 'trigger')
           or has_table_privilege(r.role, c.oid, 'maintain'))
       order by 1`);
    expect(held).toEqual([]);
  });

  it("anon still reads public profiles and runs a public read function; authenticated still runs a participation function", async () => {
    const read = await withSuperuser(async (db) => {
      const access = await db.query(`
        select has_table_privilege('anon', 'public.profiles', 'select') as profile_read,
               has_function_privilege('anon', 'public.list_public_updates(integer,timestamptz,uuid,boolean)', 'execute') as public_read,
               has_function_privilege('authenticated', 'public.create_report(text,uuid,text,text)', 'execute') as report
      `);
      return access.rows[0];
    });
    expect(read).toEqual({ profile_read: true, public_read: true, report: true });
  });
});

describe("objects created later in the application schema", () => {
  it("a table created by the migration owner grants nothing to anon, authenticated or service_role", async () => {
    const name = `zz_privilege_probe_${Math.random().toString(36).slice(2, 8)}`;
    await withSuperuser(async (db) => {
      await db.query(`create table public.${name} (id uuid primary key)`);
      try {
        const access = await db.query(`
          select r.role, p.priv, has_table_privilege(r.role, 'public.${name}', p.priv) as held
            from (values ('anon'), ('authenticated'), ('service_role')) as r(role)
            cross join (values ('select'), ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger')) as p(priv)
        `);
        expect(access.rows.filter((row) => row.held)).toEqual([]);
      } finally {
        await db.query(`drop table if exists public.${name}`);
      }
    });
  });

  it("a function created with the migration convention (PUBLIC revoked explicitly) is executable by no client and no worker role", async () => {
    const name = `zz_privilege_probe_fn_${Math.random().toString(36).slice(2, 8)}`;
    await withSuperuser(async (db) => {
      await db.query(
        `create function public.${name}() returns integer language sql as $$ select 1 $$`,
      );
      try {
        await db.query(
          `revoke all on function public.${name}() from public, anon, authenticated, service_role`,
        );
        const access = await db.query(`
          select r.role, has_function_privilege(r.role, 'public.${name}()', 'execute') as held
            from (values ('public'), ('anon'), ('authenticated'), ('service_role')) as r(role)
        `);
        expect(access.rows.filter((row) => row.held)).toEqual([]);
      } finally {
        await db.query(`drop function if exists public.${name}()`);
      }
    });
  });
});
