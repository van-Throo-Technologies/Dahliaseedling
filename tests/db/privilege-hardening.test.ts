import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto, publishPublicImage } from "../support/public-update";

/*
 * Phase 10A privilege hardening. The trigger functions are never callable by a visitor or a grower. The set of SECURITY DEFINER functions
 * a visitor may run is an exact allowlist, so a new grant cannot appear unnoticed. Public reads that depend on row-level security still work.
 */

const TRIGGER_FUNCTIONS = [
  "_comment_after",
  "_messages_after",
  "_messages_guard",
  "_rehome_case_after",
  "_rehome_interest_after",
  "_rehome_interest_before",
  "_seed_offer_interest_after",
  "_seed_offer_interest_before",
  "_update_after",
  "_rate_limit_comments",
  "_rate_limit_messages",
  "_rate_limit_reports",
  "_rate_limit_rehome_interests",
  "_rate_limit_seed_offer_interests",
  "_rate_limit_availability",
];

// Definer functions a visitor may execute: the public read RPCs, plus the helpers that row-level security policies call for anonymous reads.
const ANON_DEFINER_ALLOWLIST = [
  "get_public_update",
  "list_canonical_seedling_updates",
  "list_public_updates",
  "list_update_comments",
  "rehome_panel",
  "resolve_retired_identifier",
  "seedling_canonical_id",
  "seedling_cover",
  "_derivative_is_public",
  "_public_media_object_is_public",
  "_public_media_object_unregistered",
  "_seed_offer_is_public",
  "_seed_source_is_public",
  "_unidentified_source_is_public",
  "_update_is_public",
];

const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let update = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

beforeAll(async () => {
  alice = await createTestUser("ph-alice");
  bob = await createTestUser("ph-bob");
  created.push(alice.id, bob.id);
  await alice.client
    .from("profiles")
    .insert({ id: alice.id, display_name: "Alice PH", country_code: "NL" });
  await bob.client
    .from("profiles")
    .insert({ id: bob.id, display_name: "Bob PH", country_code: "BE" });
  const seedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: "Privilege fixture",
      p_visibility: "public",
    })
  ).data!.id as string;
  const photo = await capturePhoto(alice, seedling);
  update = (await publishPublicImage(alice, photo)).updateId;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("trigger functions are not callable by visitors or growers", () => {
  it.each(TRIGGER_FUNCTIONS)(
    "%s has no EXECUTE for PUBLIC, anon or authenticated",
    async (name) => {
      const [row] = await rows(
        `select has_function_privilege('anon', 'public.${name}()', 'EXECUTE') as anon,
              has_function_privilege('authenticated', 'public.${name}()', 'EXECUTE') as authenticated`,
      );
      expect(row).toEqual({ anon: false, authenticated: false });
    },
  );

  it("no trigger function is executable by anon or authenticated through any grant", async () => {
    const leaked = await rows(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and exists (select 1 from pg_trigger t where t.tgfoid = p.oid)
          and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`,
    );
    expect(leaked).toEqual([]);
  });

  it("a grower calling a trigger function over the API is refused", async () => {
    const { error } = await alice.client.rpc("_comment_after");
    expect(error).not.toBeNull();
  });
});

describe("the visitor-executable definer functions are an exact allowlist", () => {
  it("matches the allowlist, so a new anonymous grant cannot appear unnoticed", async () => {
    const actual = (
      await rows(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
          order by 1`,
      )
    ).map((r) => r.proname as string);
    expect(actual).toEqual([...ANON_DEFINER_ALLOWLIST].sort());
  });
});

describe("legitimate policy and read paths keep working", () => {
  it("a visitor still reads a public Update through the public RPC", async () => {
    const { data, error } = await visitor.rpc("list_public_updates", { p_limit: 50 });
    expect(error).toBeNull();
    expect((data as { update_id: string }[]).map((r) => r.update_id)).toContain(update);
  });

  it("a visitor still reads public Update media through the policy helper", async () => {
    const { data, error } = await visitor.rpc("list_canonical_seedling_updates", {
      p_seedling_id: (
        await rows("select seedling_id::text from public.updates where id = $1", [update])
      )[0]!.seedling_id,
    });
    expect(error).toBeNull();
    expect((data as { update_id: string }[]).map((r) => r.update_id)).toContain(update);
  });

  it("a visitor cannot run the rate-limit helper or read its counters", async () => {
    const counters = await visitor.from("rate_counters").select("user_id");
    expect(counters.data ?? []).toEqual([]);
    const { error } = await visitor.rpc("_rate_limit_consume", {
      p_action: "comment",
      p_user: alice.id,
    });
    expect(error).not.toBeNull();
  });
});
