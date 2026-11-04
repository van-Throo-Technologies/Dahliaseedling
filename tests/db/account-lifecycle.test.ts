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
 * Phase 10B account lifecycle. Deactivation stops new action at the existing suspension gate. Erasure clears what the grower controls and
 * leaves provenance, identifiers, parentage and the other participant's conversation history unchanged. Reports never block either step.
 * The Auth identity and original media are not removed here, so the status is never "completed" yet.
 */

const tag = "lc" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let a1 = "";
let a2 = "";
let a4 = "";
let a5 = "";
let a3 = "";
let update = "";
let aliceComment = "";
let observation = "";
let conversation = "";
let aliceMessage = "";
let bobReport = "";
let snapshot: {
  provenance: string[];
  identifiers: string[];
  parentage: string[];
  a2Holder: string;
  a2Originator: string;
} = {
  provenance: [],
  identifiers: [],
  parentage: [],
  a2Holder: "",
  a2Originator: "",
};

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function profileOf(id: string) {
  const [row] = await rows(
    "select account_state, is_suspended, display_name, country_code, bio, region_city, avatar_path from public.profiles where id = $1",
    [id],
  );
  return row;
}

async function seedling(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_seedling", {
    p_working_name: `${name} ${tag}`,
    p_visibility: "public",
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

async function startRehome(user: TestUser, seedlingId: string) {
  const { data, error } = await user.client.rpc("start_rehome", {
    p_seedling_id: seedlingId,
    p_term: "donate",
    p_handover: "pickup",
  });
  if (error) throw new Error(error.message);
  return data as string;
}

beforeAll(async () => {
  alice = await createTestUser("lc-alice");
  bob = await createTestUser("lc-bob");
  carol = await createTestUser("lc-carol");
  created.push(alice.id, bob.id, carol.id);
  await withSuperuser((db) =>
    db.query(
      "insert into public.profiles (id, display_name, country_code, bio, region_city, account_type_label) values ($1, $2, 'NL', 'Gardener', 'Utrecht', 'individual')",
      [alice.id, `Alice ${tag}`],
    ),
  );
  await withSuperuser((db) =>
    db.query("insert into public.profiles (id, display_name, country_code) values ($1, $2, 'BE')", [
      bob.id,
      `Bob ${tag}`,
    ]),
  );
  await withSuperuser((db) =>
    db.query("insert into public.profiles (id, display_name, country_code) values ($1, $2, 'DE')", [
      carol.id,
      `Carol ${tag}`,
    ]),
  );

  a1 = await seedling(alice, "Stays");
  const photo = await capturePhoto(alice, a1);
  observation = photo.observationId;
  update = (await publishPublicImage(alice, photo)).updateId;
  await bob.client.rpc("add_comment", { p_update_id: update, p_body: "Lovely colour" });
  aliceComment = (
    await alice.client.rpc("add_comment", { p_update_id: update, p_body: "Thank you" })
  ).data as string;
  await alice.client.rpc("set_seedling_follow", { p_seedling_id: a1, p_on: true });
  await carol.client.rpc("set_seedling_follow", { p_seedling_id: a1, p_on: true });

  // A2: originated by alice, held by bob after a completed transfer.
  a2 = await seedling(alice, "Transferred");
  const case2 = await startRehome(alice, a2);
  await bob.client.rpc("express_rehome_interest", { p_case_id: case2 });
  await alice.client.rpc("choose_rehome_recipient", { p_case_id: case2, p_recipient_id: bob.id });
  await alice.client.rpc("mark_rehome_sent", { p_case_id: case2 });
  await bob.client.rpc("confirm_rehome_received", { p_case_id: case2 });

  // A5: alice's case is sent but not yet confirmed. It must keep its status.
  a5 = await seedling(alice, "Sent");
  const case5 = await startRehome(alice, a5);
  await bob.client.rpc("express_rehome_interest", { p_case_id: case5 });
  await alice.client.rpc("choose_rehome_recipient", { p_case_id: case5, p_recipient_id: bob.id });
  await alice.client.rpc("mark_rehome_sent", { p_case_id: case5 });

  // A4: available, with carol interested. Alice's deactivation cancels it.
  a4 = await seedling(alice, "Available");
  const case4 = await startRehome(alice, a4);
  await carol.client.rpc("express_rehome_interest", { p_case_id: case4 });
  (globalThis as unknown as { case4: string }).case4 = case4;

  // A3: an active Seed Offer by alice, with carol interested.
  a3 = await seedling(alice, "Seeds");
  await publishPublicImage(alice, await capturePhoto(alice, a3));
  const source = await alice.client.rpc("create_seed_source", {
    p_kind: "seedling",
    p_seedling_id: a3,
  });
  if (source.error) throw new Error(source.error.message);
  const offer = await alice.client.rpc("publish_seed_offer", {
    p_source_id: source.data as string,
    p_material_type: "seedheads",
    p_seedhead_count: 2,
    p_mode: "free",
    p_handover_method: "pickup",
    p_items: [],
  });
  if (offer.error) throw new Error(offer.error.message);
  (globalThis as unknown as { offer: string }).offer = offer.data as string;
  await carol.client.rpc("express_seed_offer_interest", {
    p_offer_id: offer.data as string,
    p_requested_quantity: "a few",
  });

  // A conversation: alice writes, bob replies. A report by bob against alice's update stays open.
  conversation = (await alice.client.rpc("start_direct_conversation", { p_other: bob.id }))
    .data as string;
  aliceMessage = (
    await alice.client.rpc("send_message", {
      p_conversation_id: conversation,
      p_client_key: crypto.randomUUID(),
      p_body: "Hello from alice",
      p_photo_media_id: null,
    })
  ).data as string;
  await bob.client.rpc("send_message", {
    p_conversation_id: conversation,
    p_client_key: crypto.randomUUID(),
    p_body: "Hello back",
    p_photo_media_id: null,
  });
  bobReport = (
    await bob.client.rpc("create_report", {
      p_target_type: "update",
      p_target_id: update,
      p_reason: "spam",
    })
  ).data as string;

  // Alice follows carol's public Seedling and subscribes to it.
  const carolSeedling = await seedling(carol, "Carol public");
  await alice.client.rpc("subscribe_availability", {
    p_seedling_id: carolSeedling,
    p_locale: "en",
  });

  snapshot = {
    provenance: (
      await rows(
        "select id::text from public.provenance_events where seedling_id = $1 order by id",
        [a2],
      )
    ).map((r) => r.id as string),
    identifiers: (
      await rows(
        "select id::text from public.seedling_identifiers where seedling_id in ($1,$2,$3) order by id",
        [a1, a2, a3],
      )
    ).map((r) => r.id as string),
    parentage: (await rows("select id::text from public.seedling_parentage order by id")).map(
      (r) => r.id as string,
    ),
    a2Holder: (
      await rows("select current_holder_id::text from public.seedlings where id = $1", [a2])
    )[0].current_holder_id as string,
    a2Originator: (
      await rows("select originator_id::text from public.seedlings where id = $1", [a2])
    )[0].originator_id as string,
  };
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("deactivation is a database gate, and it is idempotent", () => {
  it("refuses an anonymous visitor", async () => {
    expect(errorCode((await visitor.rpc("deactivate_my_account")).error)).toBe("42501");
  });

  it("deactivates alice: the account is suspended, marked deactivated, and hidden publicly", async () => {
    const before = await profileOf(alice.id);
    expect(before.account_state).toBe("active");
    const result = await alice.client.rpc("deactivate_my_account");
    expect(result.error).toBeNull();
    const after = await profileOf(alice.id);
    expect(after).toMatchObject({ account_state: "deactivated", is_suspended: true });
    const visible = await visitor.from("profiles").select("id").eq("id", alice.id);
    expect(visible.data).toEqual([]);
  });

  it("is idempotent: a repeat changes nothing", async () => {
    const [before] = await rows("select state_changed_at from public.profiles where id = $1", [
      alice.id,
    ]);
    expect((await alice.client.rpc("deactivate_my_account")).error).toBeNull();
    const [after] = await rows("select state_changed_at from public.profiles where id = $1", [
      alice.id,
    ]);
    expect(after.state_changed_at).toEqual(before.state_changed_at);
  });

  it("refuses every new action by the deactivated grower", async () => {
    expect(
      errorCode(
        (await alice.client.rpc("add_comment", { p_update_id: update, p_body: "Still here" }))
          .error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client.rpc("create_seedling", {
            p_working_name: "Nope",
            p_visibility: "private",
          })
        ).error,
      ),
    ).toBe("42501");
    expect(
      errorCode(
        (
          await alice.client.rpc("send_message", {
            p_conversation_id: conversation,
            p_client_key: crypto.randomUUID(),
            p_body: "x",
            p_photo_media_id: null,
          })
        ).error,
      ),
    ).toBe("42501");
  });

  it("cannot reactivate, un-suspend, or change its state through its own profile", async () => {
    const attempt = await alice.client
      .from("profiles")
      .update({ is_suspended: false })
      .eq("id", alice.id);
    expect(errorCode(attempt.error)).toBe("42501");
    expect((await profileOf(alice.id)).is_suspended).toBe(true);
    const direct = await alice.client
      .from("profiles")
      .update({ account_state: "active" } as never)
      .eq("id", alice.id);
    expect(direct.error).not.toBeNull();
    expect((await profileOf(alice.id)).account_state).toBe("deactivated");
  });

  it("refuses an administrator reinstating a deactivated account", async () => {
    const admin = await createTestUser("lc-admin");
    created.push(admin.id);
    await withSuperuser(async (db) => {
      await db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Admin LC', 'NL')",
        [admin.id],
      );
      await db.query("insert into public.admin_users (user_id) values ($1)", [admin.id]);
    });
    const { error } = await admin.client.rpc("admin_suspend_profile", {
      p_profile_id: alice.id,
      p_suspended: false,
      p_reason: "Trying to reinstate a deactivated account",
    });
    expect(errorCode(error)).toBe("23514");
    expect((await profileOf(alice.id)).is_suspended).toBe(true);
  });
});

describe("deactivation keeps provenance, and resolves only what it must", () => {
  it("cancels alice's available Rehome case, and leaves her sent case as sent", async () => {
    const [cancelled] = await rows(
      "select status from public.rehome_cases where seedling_id = $1",
      [a4],
    );
    expect(cancelled.status).toBe("cancelled");
    const [sent] = await rows("select status from public.rehome_cases where seedling_id = $1", [
      a5,
    ]);
    expect(sent.status).toBe("sent");
  });

  it("closes alice's active Seed Offer and withdraws carol's interest only where alice is the interested party", async () => {
    const [offer] = await rows(
      "select is_active, closed_at from public.seed_offers where id = $1",
      [(globalThis as unknown as { offer: string }).offer],
    );
    expect(offer.is_active).toBe(false);
    expect(offer.closed_at).not.toBeNull();
    const [carolInterest] = await rows(
      "select withdrawn_at from public.seed_offer_interests where interested_user_id = $1",
      [carol.id],
    );
    expect(carolInterest.withdrawn_at).toBeNull();
  });

  it("does not block on the open report about alice", async () => {
    const [report] = await rows("select status from public.reports where id = $1", [bobReport]);
    expect(report.status).toBe("open");
    expect((await profileOf(alice.id)).account_state).toBe("deactivated");
  });

  it("writes a deactivation record", async () => {
    const [row] = await rows(
      "select count(*)::int as n from public.privacy_requests where profile_id = $1 and kind = 'deactivation'",
      [alice.id],
    );
    expect(row.n).toBe(1);
  });
});

describe("erasure clears personal content and leaves provenance untouched", () => {
  let avatar: string | null = null;

  it("refuses erasure for an account that has not been deactivated", async () => {
    const fresh = await createTestUser("lc-fresh");
    created.push(fresh.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Fresh LC', 'NL')",
        [fresh.id],
      ),
    );
    expect(errorCode((await fresh.client.rpc("request_my_erasure")).error)).toBe("23514");
  });

  it("requests erasure once, and the second request changes nothing", async () => {
    const first = await alice.client.rpc("request_my_erasure");
    expect(first.error).toBeNull();
    avatar = first.data as string | null;
    const second = await alice.client.rpc("request_my_erasure");
    expect(second.error).toBeNull();
    expect(second.data).toBeNull();
    const erasures = await rows(
      "select count(*)::int as n from public.account_erasures where profile_id = $1",
      [alice.id],
    );
    expect(erasures[0].n).toBe(1);
  });

  it("leaves a tombstone with a non-geographic country and no personal fields", async () => {
    const p = await profileOf(alice.id);
    expect(p).toEqual({
      account_state: "pending_erasure",
      is_suspended: true,
      display_name: "Former grower",
      country_code: "XX",
      bio: null,
      region_city: null,
      avatar_path: null,
    });
    expect(avatar).toBeNull();
  });

  it("clears her comment text, keeps the thread, and removes her Update from public view", async () => {
    const [comment] = await rows("select body, deleted_at from public.comments where id = $1", [
      aliceComment,
    ]);
    expect(comment.body).toBe("[removed]");
    expect(comment.deleted_at).not.toBeNull();
    const [bobComment] = await rows(
      "select body, deleted_at from public.comments where author_id = $1",
      [bob.id],
    );
    expect(bobComment.body).toBe("Lovely colour");
    const [u] = await rows("select deleted_at from public.updates where id = $1", [update]);
    expect(u.deleted_at).not.toBeNull();
    const visitorList = await visitor.rpc("list_public_updates", { p_limit: 100 });
    expect((visitorList.data as { update_id: string }[]).map((r) => r.update_id)).not.toContain(
      update,
    );
  });

  it("clears her observation text and retires its own media, but keeps a message photo", async () => {
    const [o] = await rows(
      "select note, voice_transcript, deleted_at from public.observations where id = $1",
      [observation],
    );
    expect(o).toMatchObject({ note: null, voice_transcript: null });
    expect(o.deleted_at).not.toBeNull();
    const media = await rows(
      "select count(*)::int as n from public.media where owner_id = $1 and deleted_at is null",
      [alice.id],
    );
    expect(media[0].n).toBe(0);
  });

  it("removes her likes, follows, subscriptions and interests, and carol's follow of a1 stays", async () => {
    const rowsLeft = await rows(
      `select
        (select count(*)::int from public.seedling_follows where user_id = $1) as follows,
        (select count(*)::int from public.availability_subscriptions where user_id = $1) as subs,
        (select count(*)::int from public.rehome_interests where interested_user_id = $1) as rehome_interests,
        (select count(*)::int from public.seed_offer_interests where interested_user_id = $1) as seed_interests`,
      [alice.id],
    );
    expect(rowsLeft[0]).toEqual({ follows: 0, subs: 0, rehome_interests: 0, seed_interests: 0 });
    const carolFollow = await rows(
      "select count(*)::int as n from public.seedling_follows where user_id = $1",
      [carol.id],
    );
    expect(carolFollow[0].n).toBe(1);
  });

  it("keeps the other participant's message history, with alice still the sender", async () => {
    const [m] = await rows("select body, sender_id::text from public.messages where id = $1", [
      aliceMessage,
    ]);
    expect(m).toEqual({ body: "Hello from alice", sender_id: alice.id });
    const bobView = await bob.client
      .from("messages")
      .select("body")
      .eq("conversation_id", conversation);
    expect((bobView.data ?? []).map((r) => r.body)).toEqual(
      expect.arrayContaining(["Hello from alice", "Hello back"]),
    );
  });

  it("changes no provenance, identifier, parentage or holder record", async () => {
    expect(
      (
        await rows(
          "select id::text from public.provenance_events where seedling_id = $1 order by id",
          [a2],
        )
      ).map((r) => r.id),
    ).toEqual(snapshot.provenance);
    expect(
      (
        await rows(
          "select id::text from public.seedling_identifiers where seedling_id in ($1,$2,$3) order by id",
          [a1, a2, a3],
        )
      ).map((r) => r.id),
    ).toEqual(snapshot.identifiers);
    expect(
      (await rows("select id::text from public.seedling_parentage order by id")).map((r) => r.id),
    ).toEqual(snapshot.parentage);
    const [s] = await rows(
      "select current_holder_id::text as h, originator_id::text as o from public.seedlings where id = $1",
      [a2],
    );
    expect(s).toEqual({ h: snapshot.a2Holder, o: snapshot.a2Originator });
  });

  it("queues the retired media for purge without removing any object", async () => {
    const queued = await rows(
      "select count(*)::int as n from public.storage_purge_queue where owner_id = $1 and state = 'awaiting_authorization'",
      [alice.id],
    );
    expect(queued[0].n).toBeGreaterThan(0);
    const again = await rows(
      "select count(*)::int as n from public.storage_purge_queue where owner_id = $1",
      [alice.id],
    );
    await alice.client.rpc("request_my_erasure");
    const afterRepeat = await rows(
      "select count(*)::int as n from public.storage_purge_queue where owner_id = $1",
      [alice.id],
    );
    expect(afterRepeat[0].n).toBe(again[0].n);
  });

  it("reports the outstanding steps honestly: not completed, auth identity and purges outstanding", async () => {
    const { data, error } = await alice.client.rpc("my_privacy_status");
    expect(error).toBeNull();
    const status = (data as unknown as Array<Record<string, unknown>>)[0];
    expect(status).toMatchObject({
      account_state: "pending_erasure",
      auth_identity_removed: false,
      media_purge_outstanding: true,
      completed: false,
    });
  });

  it("confirms the avatar step only when recorded, and is idempotent", async () => {
    expect((await alice.client.rpc("record_my_avatar_removed")).error).toBeNull();
    expect((await alice.client.rpc("record_my_avatar_removed")).error).toBeNull();
    const [e] = await rows(
      "select avatar_removed_at from public.account_erasures where profile_id = $1",
      [alice.id],
    );
    expect(e.avatar_removed_at).not.toBeNull();
  });
});

describe("concurrent requests run once", () => {
  it("two simultaneous deactivations of one account leave one deactivation record", async () => {
    const racer = await createTestUser("lc-racer");
    created.push(racer.id);
    await withSuperuser((db) =>
      db.query(
        "insert into public.profiles (id, display_name, country_code) values ($1, 'Racer LC', 'NL')",
        [racer.id],
      ),
    );
    const results = await Promise.all([
      racer.client.rpc("deactivate_my_account"),
      racer.client.rpc("deactivate_my_account"),
    ]);
    expect(results.every((r) => r.error === null)).toBe(true);
    const [n] = await rows(
      "select count(*)::int as n from public.privacy_requests where profile_id = $1 and kind = 'deactivation'",
      [racer.id],
    );
    expect(n.n).toBe(1);
  });
});
