import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * The privilege model, tested under the hosted-equivalent defaults (supabase/roles.sql). The model is pinned exactly: every client and worker
 * right on public objects is listed here, so a new grant cannot appear unnoticed. Behaviour is tested too, because a grant can be present
 * and still be unreachable, and a missing grant can break a legitimate path.
 */

const EMAIL_FUNCTIONS = [
  "email_claim_due",
  "email_delivery_context",
  "email_record_failed",
  "email_record_retry",
  "email_record_sent",
];

// Client-facing writes that are intended: profile setup and profile editing, owner-scoped observation and Seedling fields, and a series flag.
// Everything else is read-only to clients, and a grower changes rows through functions.
const INTENDED_CLIENT_WRITES = [
  "authenticated observations(note,observed_at) UPDATE",
  "authenticated profiles(account_type_label,avatar_path,bio,country_code,display_name,id,region_city) INSERT",
  "authenticated profiles(account_type_label,avatar_path,bio,country_code,display_name,region_city) UPDATE",
  "authenticated seedlings(first_grown_year,visibility,working_name) UPDATE",
  "authenticated series(active) UPDATE",
];

const ANON_FUNCTIONS = [
  "_derivative_is_public",
  "_public_media_object_is_public",
  "_public_media_object_unregistered",
  "_seed_offer_is_public",
  "_seed_source_is_public",
  "_unidentified_source_is_public",
  "_update_is_public",
  "get_public_update",
  "list_canonical_seedling_updates",
  "list_public_updates",
  "list_update_comments",
  "rehome_panel",
  "resolve_retired_identifier",
  "search_growers",
  "search_cultivars",
  "search_seed_offers",
  "search_seedlings",
  "search_identifier",
  "search_text",
  "seedling_canonical_id",
  "seedling_cover",
  // Two signatures: the deployed five-argument rollout wrapper and the seven-argument per-visitor function.
  "submit_invitation_request",
  "submit_invitation_request",
];

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let update = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function asRole(role: "service_role", sql: string) {
  return withSuperuser(async (db) => {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      return (await db.query(sql)).rows;
    } finally {
      await db.query("rollback");
    }
  });
}

beforeAll(async () => {
  alice = await createTestUser("pm-alice");
  bob = await createTestUser("pm-bob");
  created.push(alice.id, bob.id);
  await withSuperuser(async (db) => {
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, 'Alice PM', 'NL')",
      [alice.id],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, 'Bob PM', 'BE')",
      [bob.id],
    );
  });
  const seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Privilege model",
      p_visibility: "public",
    })
  ).data!.id as string;
  update = (await publishPublicImage(alice, await capturePhoto(alice, seedling))).updateId;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the pinned privilege model", () => {
  it("client table writes are exactly the intended profile, observation, seedling and series columns", async () => {
    const found = await rows(
      `select grantee || ' ' || table_name || ' ' || privilege_type as k from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
       union all
       select grantee || ' ' || table_name || '(' || string_agg(column_name, ',' order by column_name) || ') ' || privilege_type
         from information_schema.column_privileges
        where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE')
        group by grantee, table_name, privilege_type`,
    );
    expect(found.map((r) => r.k as string).sort()).toEqual([...INTENDED_CLIENT_WRITES].sort());
  });

  it("anonymous visitors execute only the public read functions and the policy helpers", async () => {
    const found = await rows(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1`,
    );
    expect(found.map((r) => r.proname as string)).toEqual([...ANON_FUNCTIONS].sort());
    expect(ANON_FUNCTIONS).toHaveLength(23);
  });

  it("the authenticated role executes exactly 108 public functions, including the invitation password, invitation request and activity functions", async () => {
    const [count] = await rows(
      `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')`,
    );
    expect(count.n).toBe(108);
    const invitation = await rows(
      `select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname in ('invitation_password_pending', 'complete_invitation_password')
        order by 1`,
    );
    expect(invitation).toEqual([
      { proname: "complete_invitation_password", authenticated: true, anon: false },
      { proname: "invitation_password_pending", authenticated: true, anon: false },
    ]);
  });

  it("the invitation completion record is unreadable and unwritable by clients", async () => {
    const [grants] = await rows(
      `select has_table_privilege('anon', 'public.invitation_completions', 'SELECT,INSERT,UPDATE,DELETE') as anon,
              has_table_privilege('authenticated', 'public.invitation_completions', 'SELECT,INSERT,UPDATE,DELETE') as authenticated,
              (select relrowsecurity from pg_class where oid = 'public.invitation_completions'::regclass) as rls`,
    );
    expect(grants).toEqual({ anon: false, authenticated: false, rls: true });
  });

  it("the legacy journey read is executable by no client role, and PUBLIC keeps no grant", async () => {
    const [legacy] = await rows(
      `select has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
              exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0) as public_grant
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'list_seedling_updates'`,
    );
    expect(legacy).toEqual({ anon: false, authenticated: false, public_grant: false });
  });

  it("the service role executes exactly the five approved email functions, and no table", async () => {
    const found = await rows(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('service_role', p.oid, 'EXECUTE') order by 1`,
    );
    expect(found.map((r) => r.proname as string)).toEqual([...EMAIL_FUNCTIONS].sort());
    const tables = await rows(
      `select count(*)::int as n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'service_role'`,
    );
    expect(tables[0].n).toBe(0);
  });

  it("trigger functions are executable by no client or worker role", async () => {
    const leaked = await rows(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and exists (select 1 from pg_trigger t where t.tgfoid = p.oid)
          and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE')
            or has_function_privilege('service_role', p.oid, 'EXECUTE'))`,
    );
    expect(leaked).toEqual([]);
  });
});

describe("a grower cannot change protected state, or another grower's data", () => {
  it("cannot set its own account_state or is_suspended", async () => {
    const state = await alice.client
      .from("profiles")
      .update({ account_state: "active" } as never)
      .eq("id", alice.id);
    expect(errorCode(state.error)).toBe("42501");
    const suspension = await alice.client
      .from("profiles")
      .update({ is_suspended: false } as never)
      .eq("id", alice.id);
    expect(errorCode(suspension.error)).toBe("42501");
  });

  it("cannot change another grower's profile, observation or Seedling", async () => {
    await bob.client.from("profiles").update({ display_name: "Hijacked" }).eq("id", alice.id);
    const [profile] = await rows("select display_name from public.profiles where id = $1", [
      alice.id,
    ]);
    expect(profile.display_name).toBe("Alice PM");
    const seedlings = await bob.client
      .from("seedlings")
      .update({ working_name: "Hijacked" })
      .eq("originator_id", alice.id);
    expect(seedlings.error === null ? seedlings.data : errorCode(seedlings.error)).not.toBe(
      "hijacked",
    );
    const [seedling] = await rows(
      "select working_name from public.seedlings where originator_id = $1",
      [alice.id],
    );
    expect(seedling.working_name).toBe("Privilege model");
  });

  it("cannot insert or delete provenance, media, comments or reports directly", async () => {
    expect(
      errorCode(
        (
          await alice.client
            .from("provenance_events")
            .insert({ seedling_id: update, event_type: "x" } as never)
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode((await alice.client.from("media").delete().eq("owner_id", alice.id)).error),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client
            .from("comments")
            .insert({ update_id: update, author_id: alice.id, body: "direct" } as never)
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client.from("reports").insert({
            reporter_id: alice.id,
            reported_user_id: bob.id,
            target_type: "profile",
            target_id: bob.id,
            reason: "spam",
          } as never)
        ).error,
      ),
    ).toBe("42501");
  });

  it("cannot read another grower's private observation through a table read", async () => {
    const read = await bob.client.from("observations").select("note").eq("author_id", alice.id);
    expect(read.data ?? []).toEqual([]);
  });
});

describe("unauthorised function execution is refused", () => {
  it("an anonymous visitor cannot call a policy-internal or administrator function", async () => {
    expect(errorCode((await visitor.rpc("is_admin")).error)).toBe("42501");
    expect(errorCode((await visitor.rpc("storage_orphan_candidates", { p_limit: 5 })).error)).toBe(
      "42501",
    );
    expect(
      errorCode(
        (
          await visitor.rpc("admin_suspend_profile", {
            p_profile_id: bob.id,
            p_suspended: true,
            p_reason: "x",
          })
        ).error,
      ),
    ).toBe("42501");
  });

  it("a grower cannot call a rate-limit helper, a trigger function, or an email function", async () => {
    // Refused either by privilege (42501) or because the API does not expose the function to this role (PGRST202). Both mean no execution.
    const calls = [
      alice.client.rpc("_rate_limit_consume", { p_action: "comment", p_user: alice.id }),
      alice.client.rpc("protect_comment"),
      alice.client.rpc("email_claim_due", { p_limit: 0, p_lease_seconds: 1 }),
    ];
    for (const call of calls)
      expect(["42501", "PGRST202"]).toContain(errorCode((await call).error));
  });
});

describe("legitimate paths keep working under the model", () => {
  it("a grower edits their own profile fields", async () => {
    const edit = await alice.client
      .from("profiles")
      .update({ bio: "Gardening notes", region_city: "Utrecht" })
      .eq("id", alice.id)
      .select("bio");
    expect(edit.error).toBeNull();
    expect(edit.data).toEqual([{ bio: "Gardening notes" }]);
  });

  it("a grower reads their own Seedlings and a visitor reads public Updates", async () => {
    const own = await alice.client.from("seedlings").select("id").eq("originator_id", alice.id);
    expect(own.error).toBeNull();
    expect((own.data ?? []).length).toBeGreaterThan(0);
    const updates = await visitor.rpc("list_public_updates", { p_limit: 20 });
    expect(updates.error).toBeNull();
    expect((updates.data as { update_id: string }[]).map((r) => r.update_id)).toContain(update);
  });

  it("the email worker's functions are reachable by the service role", async () => {
    const claimed = await asRole(
      "service_role",
      "select count(*)::int as n from public.email_claim_due(0, 1)",
    );
    expect(typeof claimed[0].n).toBe("number");
  });
});
