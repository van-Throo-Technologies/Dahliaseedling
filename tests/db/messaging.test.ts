import sharp from "sharp";
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
 * Phase 8: messages, notifications, blocks, reports and Notify-me-if-available. The conversation opens from a real Rehome
 * interest, so the context is the one a grower actually reached. Every write goes through the function a browser would call,
 * and every read goes through the caller's own session. Superuser queries check only what a client cannot read: the
 * outbox, the stored report snapshot, and admin rows.
 */

const visitor = anonClient();
const tag = "mg" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
let alice: TestUser; // holder of the Seedlings and the Rehome cases
let bob: TestUser; // a grower interested in the first case, later blocked
let carol: TestUser; // a grower who never takes part, and who is later suspended
let dan: TestUser; // a grower who is chosen as recipient for the availability case

let seedlingA = ""; // public, first case, conversation with bob
let caseA = "";
let seedlingB = ""; // public, second case, used to prove the block refuses new interest
let caseB = "";
let seedlingPrivate = ""; // private, never subscribable
let seedlingC = ""; // public, availability subscriber then case
let caseC = "";
let conv = ""; // alice and bob, on caseA
let firstMessage = "";
let reportId = "";

async function rows(sql: string, params: unknown[] = []) {
  return withSuperuser(async (db) => (await db.query(sql, params)).rows);
}

async function profile(user: TestUser, name: string, country: string) {
  const { error } = await user.client
    .from("profiles")
    .insert({ id: user.id, display_name: `${name} ${tag}`, country_code: country });
  if (error) throw new Error(error.message);
}

async function newSeedling(user: TestUser, visibility: "public" | "private", name: string) {
  const { data, error } = await user.client.rpc("create_seedling", {
    p_working_name: `${name} ${tag}`,
    p_visibility: visibility,
  });
  if (error) throw new Error(error.message);
  return data!.id as string;
}

async function openCase(seedling: string) {
  const { data, error } = await alice.client.rpc("start_rehome", {
    p_seedling_id: seedling,
    p_term: "donate",
    p_price_text: null,
    p_handover: "pickup",
    p_note: null,
    p_make_public: false,
  });
  if (error) throw new Error(error.message);
  return (typeof data === "string" ? data : (data as { id: string }).id) as string;
}

async function jpeg(): Promise<Buffer> {
  return sharp({ create: { width: 400, height: 300, channels: 3, background: "rgb(90,140,90)" } })
    .jpeg()
    .toBuffer();
}

beforeAll(async () => {
  alice = await createTestUser("mg-alice");
  bob = await createTestUser("mg-bob");
  carol = await createTestUser("mg-carol");
  dan = await createTestUser("mg-dan");
  created.push(alice.id, bob.id, carol.id, dan.id);
  await profile(alice, "Alice", "NL");
  await profile(bob, "Bob", "BE");
  await profile(carol, "Carol", "DE");
  await profile(dan, "Dan", "FR");

  seedlingA = await newSeedling(alice, "public", "Messages");
  caseA = await openCase(seedlingA);
  seedlingB = await newSeedling(alice, "public", "Blocked");
  caseB = await openCase(seedlingB);
  seedlingPrivate = await newSeedling(alice, "private", "Private");
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("a Rehome interest opens a contextual conversation", () => {
  it("records the interest and notifies the holder once, however often it is repeated", async () => {
    const first = await bob.client.rpc("express_rehome_interest", { p_case_id: caseA });
    expect(first.error).toBeNull();
    const again = await bob.client.rpc("express_rehome_interest", { p_case_id: caseA });
    expect(again.error).toBeNull();

    const notes = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'rehome_interest' and rehome_case_id = $2",
      [alice.id, caseA],
    );
    expect(notes[0].n).toBe(1);
    const seen = await alice.client
      .from("notifications")
      .select("type, actor_id")
      .eq("type", "rehome_interest");
    expect(seen.data).toEqual([{ type: "rehome_interest", actor_id: bob.id }]);
  });

  it("the holder and the interested grower open the same conversation, and it is never duplicated", async () => {
    const fromHolder = await alice.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: bob.id,
    });
    expect(fromHolder.error).toBeNull();
    const fromHolderAgain = await alice.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: bob.id,
    });
    const fromBob = await bob.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: alice.id,
    });
    expect(fromHolderAgain.data).toBe(fromHolder.data);
    expect(fromBob.data).toBe(fromHolder.data);
    conv = fromHolder.data as string;

    const count = await rows(
      "select count(*)::int as n from public.conversations where rehome_case_id = $1 and context_type = 'rehome_case'",
      [caseA],
    );
    expect(count[0].n).toBe(1);
  });

  it("refuses a conversation to a grower who has no interest, and a third grower cannot open it", async () => {
    const stranger = await carol.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: alice.id,
    });
    expect(errorCode(stranger.error)).toBe("P0002");
    const holderToStranger = await alice.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: carol.id,
    });
    expect(errorCode(holderToStranger.error)).toBe("P0002");
    const interestedToOther = await bob.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: carol.id,
    });
    expect(errorCode(interestedToOther.error)).toBe("P0002");
  });

  it("the conversation is visible only to its two participants", async () => {
    const bobSees = await bob.client
      .from("conversations")
      .select("id, context_type")
      .eq("id", conv);
    expect(bobSees.data).toEqual([{ id: conv, context_type: "rehome_case" }]);
    const carolSees = await carol.client.from("conversations").select("id").eq("id", conv);
    expect(carolSees.data ?? []).toEqual([]);
    const anon = await visitor.from("conversations").select("id");
    expect(anon.data ?? []).toEqual([]);
  });
});

describe("messages: sending, idempotency, bundling and read state", () => {
  it("sends once per client key, even when the same submission is repeated at the same moment", async () => {
    const key = crypto.randomUUID();
    const first = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: key,
      p_body: "Hello from the holder",
    });
    expect(first.error).toBeNull();
    firstMessage = first.data as string;

    const retry = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: key,
      p_body: "Hello from the holder",
    });
    expect(retry.data).toBe(firstMessage);

    const burst = await Promise.all(
      Array.from({ length: 5 }, () =>
        alice.client.rpc("send_message", {
          p_conversation_id: conv,
          p_client_key: key,
          p_body: "Hello from the holder",
        }),
      ),
    );
    for (const result of burst) {
      expect(result.error).toBeNull();
      expect(result.data).toBe(firstMessage);
    }
    const stored = await rows(
      "select count(*)::int as n from public.messages where conversation_id = $1 and client_key = $2",
      [conv, key],
    );
    expect(stored[0].n).toBe(1);
  });

  it("rejects an empty message, and a message over 2000 characters", async () => {
    const empty = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "   ",
    });
    expect(errorCode(empty.error)).toBe("23514");
    const long = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "a".repeat(2001),
    });
    expect(errorCode(long.error)).toBe("23514");
  });

  it("a non-participant can neither read nor send, and cannot tell the conversation exists", async () => {
    const send = await carol.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "Let me in",
    });
    expect(errorCode(send.error)).toBe("P0002");
    const read = await carol.client.from("messages").select("id").eq("conversation_id", conv);
    expect(read.data ?? []).toEqual([]);
  });

  it("messages cannot be written directly: a client has no table grant", async () => {
    const insert = await alice.client.from("messages").insert({
      conversation_id: conv,
      sender_id: alice.id,
      body: "Direct",
      client_key: crypto.randomUUID(),
    });
    expect(insert.error).not.toBeNull();
    const notice = await alice.client.from("notifications").insert({
      recipient_id: bob.id,
      type: "message",
      dedupe_key: crypto.randomUUID(),
    });
    expect(notice.error).not.toBeNull();
  });

  it("the other participant gets one unread message notification, bundled however many messages arrive", async () => {
    await bob.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "Reply one",
    });
    await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "Follow-up",
    });
    await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "And one more",
    });

    const bundled = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'message' and conversation_id = $2 and read_at is null",
      [bob.id, conv],
    );
    expect(bundled[0].n).toBe(1);
    const unread = await bob.client.rpc("unread_conversation_count");
    expect(unread.data).toBe(1);
  });

  it("opening the conversation marks it read for that participant only", async () => {
    // Alice sent the last message, so she is caught up; Bob has not opened the thread since her messages.
    const aliceBefore = await alice.client.rpc("unread_conversation_count");
    expect(aliceBefore.data).toBe(0);
    const bobBefore = await bob.client.rpc("unread_conversation_count");
    expect(bobBefore.data).toBe(1);

    const opened = await bob.client.rpc("mark_conversation_read", { p_conversation_id: conv });
    expect(opened.error).toBeNull();
    const bobAfter = await bob.client.rpc("unread_conversation_count");
    expect(bobAfter.data).toBe(0);
    const aliceAfter = await alice.client.rpc("unread_conversation_count");
    expect(aliceAfter.data).toBe(0);
  });
});

describe("message photographs", () => {
  it("a participant sends a photograph; the other participant can view it; a stranger cannot", async () => {
    const path = `${alice.id}/${crypto.randomUUID()}.jpg`;
    const upload = await alice.client.storage.from("private-media").upload(path, await jpeg(), {
      contentType: "image/jpeg",
      upsert: false,
    });
    expect(upload.error).toBeNull();
    const registered = await alice.client.rpc("register_message_photo", { p_path: path });
    expect(registered.error).toBeNull();
    const sent = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_photo_media_id: registered.data,
    });
    expect(sent.error).toBeNull();

    const bobView = await bob.client.storage.from("private-media").download(path);
    expect(bobView.error).toBeNull();
    const carolView = await carol.client.storage.from("private-media").download(path);
    expect(carolView.error).not.toBeNull();
    const carolMedia = await carol.client
      .from("media")
      .select("id")
      .eq("id", registered.data as string);
    expect(carolMedia.data ?? []).toEqual([]);
  });

  it("a message without text or photograph is refused, and a photograph must belong to the sender", async () => {
    const none = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
    });
    expect(errorCode(none.error)).toBe("23514");
    const path = `${bob.id}/${crypto.randomUUID()}.jpg`;
    await bob.client.storage
      .from("private-media")
      .upload(path, await jpeg(), { contentType: "image/jpeg", upsert: false });
    const registered = await bob.client.rpc("register_message_photo", { p_path: path });
    const borrowed = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_photo_media_id: registered.data,
    });
    expect(errorCode(borrowed.error)).toBe("P0002");
  });
});

describe("blocks", () => {
  it("a block stops new messages and new interest in both directions, and keeps the history", async () => {
    const blocked = await alice.client.rpc("block_user", { p_target: bob.id });
    expect(blocked.error).toBeNull();

    const bobSends = await bob.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "After block",
    });
    expect(errorCode(bobSends.error)).toBe("42501");
    const aliceSends = await alice.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "After block",
    });
    expect(errorCode(aliceSends.error)).toBe("42501");

    const reopen = await bob.client.rpc("start_rehome_conversation", {
      p_case_id: caseA,
      p_with: alice.id,
    });
    expect(errorCode(reopen.error)).toBe("42501");
    const newInterest = await bob.client.rpc("express_rehome_interest", { p_case_id: caseB });
    expect(errorCode(newInterest.error)).toBe("42501");

    const history = await bob.client.from("messages").select("id").eq("conversation_id", conv);
    expect((history.data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("the block list is private to the blocker", async () => {
    const own = await alice.client.from("blocks").select("blocked_id");
    expect(own.data).toEqual([{ blocked_id: bob.id }]);
    const theirs = await bob.client.from("blocks").select("blocker_id");
    expect(theirs.data ?? []).toEqual([]);
  });

  it("a send that races a block is either written before the block or refused after it, and never deadlocks", async () => {
    for (let round = 0; round < 5; round += 1) {
      await alice.client.rpc("unblock_user", { p_target: bob.id });
      const [blockResult, sendResult] = await Promise.all([
        alice.client.rpc("block_user", { p_target: bob.id }),
        bob.client.rpc("send_message", {
          p_conversation_id: conv,
          p_client_key: crypto.randomUUID(),
          p_body: `Race ${round}`,
        }),
      ]);
      expect(blockResult.error).toBeNull();
      expect(sendResult.error === null || errorCode(sendResult.error) === "42501").toBe(true);
      const after = await bob.client.rpc("send_message", {
        p_conversation_id: conv,
        p_client_key: crypto.randomUUID(),
        p_body: "Blocked",
      });
      expect(errorCode(after.error)).toBe("42501");
    }
    await alice.client.rpc("unblock_user", { p_target: bob.id });
  });

  it("unblocking restores messaging", async () => {
    const restored = await bob.client.rpc("send_message", {
      p_conversation_id: conv,
      p_client_key: crypto.randomUUID(),
      p_body: "Back again",
    });
    expect(restored.error).toBeNull();
  });
});

describe("suspension", () => {
  it("a suspended grower cannot send, and nothing new reaches or is created for them; their data is kept", async () => {
    const kept = await rows("select count(*)::int as n from public.messages where sender_id = $1", [
      carol.id,
    ]);
    await withSuperuser((db) =>
      db.query("update public.profiles set is_suspended = true where id = $1", [carol.id]),
    );
    try {
      const send = await carol.client.rpc("send_message", {
        p_conversation_id: conv,
        p_client_key: crypto.randomUUID(),
        p_body: "Hi",
      });
      expect(errorCode(send.error)).toBe("42501");
      const opened = await alice.client.rpc("start_direct_conversation", { p_other: carol.id });
      expect(errorCode(opened.error)).toBe("P0002");
      const kept2 = await rows(
        "select count(*)::int as n from public.messages where sender_id = $1",
        [carol.id],
      );
      expect(kept2[0].n).toBe(kept[0].n);
    } finally {
      await withSuperuser((db) =>
        db.query("update public.profiles set is_suspended = false where id = $1", [carol.id]),
      );
    }
  });
});

describe("reports and admin resolution", () => {
  it("a participant can report a message, which keeps a snapshot; the reported grower never sees the report", async () => {
    const reported = await bob.client.rpc("create_report", {
      p_target_type: "message",
      p_target_id: firstMessage,
      p_reason: "harassment",
      p_details: "Unwanted tone",
    });
    expect(reported.error).toBeNull();
    reportId = reported.data as string;

    const snapshot = await rows(
      "select content_snapshot, conversation_id from public.reports where id = $1",
      [reportId],
    );
    expect(snapshot[0]).toEqual({
      content_snapshot: "Hello from the holder",
      conversation_id: conv,
    });

    const reporterSees = await bob.client.from("reports").select("id, reason").eq("id", reportId);
    expect(reporterSees.data).toEqual([{ id: reportId, reason: "harassment" }]);
    const reportedSees = await alice.client.from("reports").select("id").eq("id", reportId);
    expect(reportedSees.data ?? []).toEqual([]);
  });

  it("a stranger cannot report a message they cannot see, and a grower cannot report themselves", async () => {
    const stranger = await carol.client.rpc("create_report", {
      p_target_type: "message",
      p_target_id: firstMessage,
      p_reason: "spam",
    });
    expect(errorCode(stranger.error)).toBe("P0002");
    const self = await bob.client.rpc("create_report", {
      p_target_type: "profile",
      p_target_id: bob.id,
      p_reason: "spam",
    });
    expect(errorCode(self.error)).toBe("23514");
    const profileReport = await bob.client.rpc("create_report", {
      p_target_type: "profile",
      p_target_id: alice.id,
      p_reason: "spam",
    });
    expect(profileReport.error).toBeNull();
  });

  it("only an administrator can resolve a report, and resolution is recorded", async () => {
    const byReporter = await bob.client.rpc("resolve_report", {
      p_report_id: reportId,
      p_status: "dismissed",
      p_reason: null,
    });
    expect(errorCode(byReporter.error)).toBe("42501");

    await withSuperuser((db) =>
      db.query("insert into public.admin_users (user_id) values ($1)", [dan.id]),
    );
    try {
      const resolved = await dan.client.rpc("resolve_report", {
        p_report_id: reportId,
        p_status: "actioned",
        p_reason: "Checked the thread",
      });
      expect(resolved.error).toBeNull();
      const status = await rows("select status, reviewed_by from public.reports where id = $1", [
        reportId,
      ]);
      expect(status[0]).toEqual({ status: "actioned", reviewed_by: dan.id });
      const logged = await rows(
        "select count(*)::int as n from public.admin_actions where target_id = $1 and admin_id = $2",
        [firstMessage, dan.id],
      );
      expect(logged[0].n).toBe(1);
    } finally {
      await withSuperuser((db) =>
        db.query("delete from public.admin_users where user_id = $1", [dan.id]),
      );
    }
  });
});

describe("typed notifications and their privacy", () => {
  let holderUpdate = "";

  it("a comment notifies the update's author, but a grower's own comment does not notify them", async () => {
    const photo = await capturePhoto(alice, seedlingA);
    const published = await publishPublicImage(alice, photo);
    holderUpdate = published.updateId;

    const bobComment = await bob.client.rpc("add_comment", {
      p_update_id: holderUpdate,
      p_body: "Lovely colour",
    });
    expect(bobComment.error).toBeNull();
    const own = await alice.client.rpc("add_comment", {
      p_update_id: holderUpdate,
      p_body: "Thank you",
    });
    expect(own.error).toBeNull();

    const comments = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'comment' and update_id = $2",
      [alice.id, holderUpdate],
    );
    expect(comments[0].n).toBe(1);
    const selfNotes = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and actor_id = $1",
      [alice.id],
    );
    expect(selfNotes[0].n).toBe(0);
  });

  it("a follower of a Seedling is told about its new Update", async () => {
    const follow = await carol.client.rpc("set_seedling_follow", {
      p_seedling_id: seedlingA,
      p_on: true,
    });
    expect(follow.error).toBeNull();
    const photo = await capturePhoto(alice, seedlingA);
    await publishPublicImage(alice, photo);
    const told = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'followed_seedling_update'",
      [carol.id],
    );
    expect(told[0].n).toBe(1);
  });

  it("notifications are visible to their recipient only, and can be marked read only by them", async () => {
    const mine = await alice.client.from("notifications").select("id").eq("type", "comment");
    expect((mine.data ?? []).length).toBe(1);
    const theirs = await bob.client.from("notifications").select("id").eq("recipient_id", alice.id);
    expect(theirs.data ?? []).toEqual([]);

    const notice = mine.data![0]!.id as string;
    await bob.client.rpc("mark_notification_read", { p_notification_id: notice });
    const still = await rows("select read_at from public.notifications where id = $1", [notice]);
    expect(still[0].read_at).toBeNull();

    await alice.client.rpc("mark_notification_read", { p_notification_id: notice });
    const read = await rows("select read_at from public.notifications where id = $1", [notice]);
    expect(read[0].read_at).not.toBeNull();
  });
});

describe("Notify me if available", () => {
  it("a grower can subscribe only to a public Seedling that they do not hold", async () => {
    const privateSeedling = await carol.client.rpc("subscribe_availability", {
      p_seedling_id: seedlingPrivate,
    });
    expect(errorCode(privateSeedling.error)).toBe("P0002");
    const ownSeedling = await alice.client.rpc("subscribe_availability", {
      p_seedling_id: seedlingA,
    });
    expect(errorCode(ownSeedling.error)).toBe("P0002");
  });

  it("when the Seedling becomes available again, the subscriber is notified and an alert is queued once", async () => {
    seedlingC = await newSeedling(alice, "public", "Available");
    const subscribed = await carol.client.rpc("subscribe_availability", {
      p_seedling_id: seedlingC,
    });
    expect(subscribed.error).toBeNull();

    caseC = await openCase(seedlingC);
    const notice = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'availability_trigger' and rehome_case_id = $2",
      [carol.id, caseC],
    );
    expect(notice[0].n).toBe(1);
    const queued = await rows(
      "select count(*)::int as n from public.email_outbox where recipient_id = $1 and kind = 'availability_alert' and rehome_case_id = $2",
      [carol.id, caseC],
    );
    expect(queued[0].n).toBe(1);
    const invisible = await carol.client.from("email_outbox").select("id");
    expect(invisible.error !== null || (invisible.data ?? []).length === 0).toBe(true);
  });

  it("a completed continuation closes the alerts for that Seedling", async () => {
    const interest = await dan.client.rpc("express_rehome_interest", { p_case_id: caseC });
    expect(interest.error).toBeNull();
    const chosen = await alice.client.rpc("choose_rehome_recipient", {
      p_case_id: caseC,
      p_recipient_id: dan.id,
    });
    expect(chosen.error).toBeNull();
    const selected = await rows(
      "select count(*)::int as n from public.notifications where recipient_id = $1 and type = 'rehome_selected' and rehome_case_id = $2",
      [dan.id, caseC],
    );
    expect(selected[0].n).toBe(1);

    expect((await alice.client.rpc("mark_rehome_sent", { p_case_id: caseC })).error).toBeNull();
    const confirmed = await dan.client.rpc("confirm_rehome_received", { p_case_id: caseC });
    expect(confirmed.error).toBeNull();

    const closed = await rows(
      "select count(*)::int as n from public.availability_subscriptions where seedling_id = $1 and user_id = $2 and closed_at is null",
      [seedlingC, carol.id],
    );
    expect(closed[0].n).toBe(0);
  });
});
