import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  errorCode,
  removeTestUsers,
  withSuperuser,
  type TestUser,
} from "../support/local-supabase";
import { capturePhoto } from "../support/public-update";

/*
 * Phase 10B export privacy. The export document runs with the caller's own privileges, so row-level security applies. It must contain
 * the caller's own records and none of another grower's identity, private observation text, private media or report identities.
 */

const tag = "ex" + Math.random().toString(36).slice(2, 8);
const created: string[] = [];
const visitor = anonClient();
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let aliceNote = "";
let bobNote = "";
let bobMediaPath = "";
let aliceMessage = "";
let bobMessage = "";
let conversation = "";
let bobReport = "";
let aliceSeedling = "";

async function document(
  client: TestUser["client"],
): Promise<{ text: string; json: Record<string, unknown> }> {
  const { data, error } = await client.rpc("account_export_document");
  if (error) throw new Error(error.message);
  return { text: JSON.stringify(data), json: data as Record<string, unknown> };
}

beforeAll(async () => {
  alice = await createTestUser("ex-alice");
  bob = await createTestUser("ex-bob");
  carol = await createTestUser("ex-carol");
  created.push(alice.id, bob.id, carol.id);
  await withSuperuser(async (db) => {
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'NL')",
      [alice.id, `Alice ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'BE')",
      [bob.id, `Bobby ${tag}`],
    );
    await db.query(
      "insert into public.profiles (id, display_name, country_code) values ($1, $2, 'DE')",
      [carol.id, `Carol ${tag}`],
    );
  });

  aliceSeedling = (
    await alice.client.rpc("create_seedling", {
      p_working_name: `Alice plant ${tag}`,
      p_visibility: "private",
    })
  ).data!.id as string;
  const aliceCapture = await capturePhoto(alice, aliceSeedling);
  aliceNote = "Alice private note about the bloom";
  await withSuperuser((db) =>
    db.query("update public.observations set note = $1 where id = $2", [
      aliceNote,
      aliceCapture.observationId,
    ]),
  );

  const bobSeedling = (
    await bob.client.rpc("create_seedling", {
      p_working_name: `Bob plant ${tag}`,
      p_visibility: "private",
    })
  ).data!.id as string;
  const bobCapture = await capturePhoto(bob, bobSeedling);
  bobNote = "Bob private note that alice must not see";
  bobMediaPath = (
    await withSuperuser((db) =>
      db.query("select storage_path from public.media where id = $1", [bobCapture.mediaId]),
    )
  ).rows[0].storage_path as string;
  await withSuperuser((db) =>
    db.query("update public.observations set note = $1 where id = $2", [
      bobNote,
      bobCapture.observationId,
    ]),
  );

  conversation = (await alice.client.rpc("start_direct_conversation", { p_other: bob.id }))
    .data as string;
  aliceMessage = `Alice says hello ${tag}`;
  await alice.client.rpc("send_message", {
    p_conversation_id: conversation,
    p_client_key: crypto.randomUUID(),
    p_body: aliceMessage,
    p_photo_media_id: null,
  });
  bobMessage = `Bob replies ${tag}`;
  await bob.client.rpc("send_message", {
    p_conversation_id: conversation,
    p_client_key: crypto.randomUUID(),
    p_body: bobMessage,
    p_photo_media_id: null,
  });

  bobReport = (
    await bob.client.rpc("create_report", {
      p_target_type: "profile",
      p_target_id: alice.id,
      p_reason: "spam",
    })
  ).data as string;
});

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the grower's own export", () => {
  it("includes the grower's own private note and their own messages, labelled as sent", async () => {
    const { json, text } = await document(alice.client);
    expect(text).toContain(aliceNote);
    const messages = json.messages as Array<{ body: string; direction: string }>;
    expect(messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: aliceMessage, direction: "sent" })]),
    );
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ body: bobMessage, direction: "received" }),
      ]),
    );
  });

  it("contains no other grower's identifier, display name, private note, or private media path", async () => {
    const { text } = await document(alice.client);
    expect(text).not.toContain(bob.id);
    expect(text).not.toContain(carol.id);
    expect(text).not.toContain(`Bobby ${tag}`);
    expect(text).not.toContain(bobNote);
    expect(text).not.toContain(bobMediaPath);
  });

  it("does not disclose reports about the grower, or who made them", async () => {
    const { text } = await document(alice.client);
    expect(text).not.toContain(bobReport);
    expect(text).not.toContain(`Bobby ${tag}`);
  });

  it("lists the grower's own media, and nobody else's", async () => {
    const { json } = await document(alice.client);
    const media = json.media as Array<{ storage_path: string }>;
    expect(media.length).toBeGreaterThan(0);
    expect(media.every((m) => !m.storage_path.startsWith(`${bob.id}/`))).toBe(true);
  });

  it("states what is excluded, so the grower knows the boundary", async () => {
    const { json } = await document(alice.client);
    expect(json.excluded).toEqual(
      expect.arrayContaining([expect.stringContaining("Reports about you")]),
    );
    expect(json.format).toBe("dahliaseedling.account-export");
  });

  it("gives another grower only their own records", async () => {
    const { text } = await document(bob.client);
    expect(text).toContain(bobNote);
    expect(text).not.toContain(aliceNote);
    expect(text).not.toContain(alice.id);
  });

  it("refuses a visitor, who has no export", async () => {
    expect(errorCode((await visitor.rpc("account_export_document")).error)).toBe("42501");
  });

  it("records an export request, for the grower's own history only", async () => {
    expect((await alice.client.rpc("note_my_export")).error).toBeNull();
    const [row] = await withSuperuser((db) =>
      db.query(
        "select count(*)::int as n from public.privacy_requests where profile_id = $1 and kind = 'export'",
        [alice.id],
      ),
    ).then((r) => r.rows);
    expect(row.n).toBe(1);
    const [other] = (
      await withSuperuser((db) =>
        db.query(
          "select count(*)::int as n from public.privacy_requests where profile_id = $1 and kind = 'export'",
          [bob.id],
        ),
      )
    ).rows;
    expect(other.n).toBe(0);
  });
});
