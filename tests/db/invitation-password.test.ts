import { afterAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  localSupabase,
  removeTestUsers,
  type TestUser,
} from "../support/local-supabase";

/*
 * The invitation password check. An invited account has no stored password until it completes its invitation. Every other account has
 * one, so the check is what keeps an ordinary signed-in session away from invitation password setup.
 */

const created: string[] = [];
const PASSWORD = "a-chosen-password-456";

async function mintInvite(email: string): Promise<string> {
  const { apiUrl, secretKey } = localSupabase();
  const response = await fetch(`${apiUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "invite", email }),
  });
  if (!response.ok) throw new Error(`Could not mint invitation: ${response.status}`);
  return ((await response.json()) as { hashed_token: string }).hashed_token;
}

afterAll(async () => {
  await removeTestUsers(created);
});

describe("the invitation password check", () => {
  it("is false for an ordinary account, which already has a password", async () => {
    const user: TestUser = await createTestUser("ip-ordinary");
    created.push(user.id);

    const { data, error } = await user.client.rpc("invitation_password_pending");
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("is refused to an anonymous caller, who has no account to check", async () => {
    const { error } = await anonClient().rpc("invitation_password_pending");
    expect(error).not.toBeNull();
  });

  it("is true for an invited account until the invitation is completed, and false afterwards", async () => {
    const email = `ip-invite-${crypto.randomUUID()}@example.test`;
    const token = await mintInvite(email);

    const invitee = anonClient();
    const verified = await invitee.auth.verifyOtp({ type: "invite", token_hash: token });
    expect(verified.error).toBeNull();
    created.push(verified.data.user!.id);

    const before = await invitee.rpc("invitation_password_pending");
    expect(before.data).toBe(true);

    const set = await invitee.auth.updateUser({ password: PASSWORD });
    expect(set.error).toBeNull();
    const recorded = await invitee.rpc("complete_invitation_password");
    expect(recorded.error).toBeNull();

    const after = await invitee.rpc("invitation_password_pending");
    expect(after.data).toBe(false);
  });

  it("is still pending after the password is stored, until completion is recorded", async () => {
    const email = `ip-stored-${crypto.randomUUID()}@example.test`;
    const token = await mintInvite(email);

    const invitee = anonClient();
    const verified = await invitee.auth.verifyOtp({ type: "invite", token_hash: token });
    created.push(verified.data.user!.id);
    await invitee.auth.updateUser({ password: PASSWORD });

    const stillPending = await invitee.rpc("invitation_password_pending");
    expect(stillPending.data).toBe(true);
  });

  it("refuses to record a completion for an ordinary account, and refuses a second completion", async () => {
    const user: TestUser = await createTestUser("ip-complete");
    created.push(user.id);
    const ordinary = await user.client.rpc("complete_invitation_password");
    expect(ordinary.error).not.toBeNull();

    const email = `ip-twice-${crypto.randomUUID()}@example.test`;
    const token = await mintInvite(email);
    const invitee = anonClient();
    const verified = await invitee.auth.verifyOtp({ type: "invite", token_hash: token });
    created.push(verified.data.user!.id);
    expect((await invitee.rpc("complete_invitation_password")).error).toBeNull();
    expect((await invitee.rpc("complete_invitation_password")).error).not.toBeNull();
  });

  it("refuses a replay of the invitation link", async () => {
    const email = `ip-replay-${crypto.randomUUID()}@example.test`;
    const token = await mintInvite(email);

    const first = await anonClient().auth.verifyOtp({ type: "invite", token_hash: token });
    expect(first.error).toBeNull();
    created.push(first.data.user!.id);

    const replay = await anonClient().auth.verifyOtp({ type: "invite", token_hash: token });
    expect(replay.error).not.toBeNull();
  });

  it("lets the invitee sign in with the password they chose", async () => {
    const email = `ip-signin-${crypto.randomUUID()}@example.test`;
    const token = await mintInvite(email);

    const invitee = anonClient();
    const verified = await invitee.auth.verifyOtp({ type: "invite", token_hash: token });
    created.push(verified.data.user!.id);
    await invitee.auth.updateUser({ password: PASSWORD });
    await invitee.auth.signOut();

    const signedIn = await anonClient().auth.signInWithPassword({ email, password: PASSWORD });
    expect(signedIn.error).toBeNull();
    expect(signedIn.data.session).not.toBeNull();
  });
});
