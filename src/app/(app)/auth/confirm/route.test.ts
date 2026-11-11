import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The confirmation route, run with its real code. The Supabase server client and the profile lookup are replaced. A confirmed sign-up must
 * leave the visitor signed in before the redirect, and a first-time grower must go to profile setup. Expired, used, malformed and
 * unsafe links must not establish a session. No token value may reach the log.
 */

const verifyOtp = vi.hoisted(() => vi.fn());
const capturedOptions = vi.hoisted(() => ({
  current: null as null | { cookies: { setAll: (c: unknown[]) => void } },
}));
const findProfile = vi.hoisted(() => vi.fn());
const logEvent = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (c: unknown[]) => void } },
  ) => {
    capturedOptions.current = options;
    return { auth: { verifyOtp } };
  },
}));
vi.mock("@/lib/config/env", () => ({
  parseAppConfig: () => ({
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "publishable",
  }),
}));
vi.mock("@/lib/logging/log", () => ({ logEvent }));
vi.mock("@/modules/identity/profile-repository", () => ({ findProfile }));

const { GET } = await import("./route");

const TOKEN_HASH = "pkce_0123456789abcdef_fixture";
const USER_ID = "11111111-1111-4111-8111-111111111111";

function confirmUrl(params: Record<string, string>): NextRequest {
  const url = new URL("https://dahliaseedling.app/auth/confirm");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new NextRequest(url);
}

/** Makes Supabase verify the link and write a session cookie through the server client, as the real client does. */
function verifySucceeds(): void {
  verifyOtp.mockImplementation(async () => {
    capturedOptions.current?.cookies.setAll([
      {
        name: "sb-project-auth-token",
        value: "session-value",
        options: { httpOnly: true, sameSite: "lax", path: "/" },
      },
    ]);
    return { data: { user: { id: USER_ID } }, error: null };
  });
}

describe("email confirmation route", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    findProfile.mockReset();
    logEvent.mockClear();
    capturedOptions.current = null;
  });

  it("signs a first-time grower in on the redirect and sends them to profile setup", async () => {
    verifySucceeds();
    findProfile.mockResolvedValue(null);
    const response = await GET(confirmUrl({ token_hash: TOKEN_HASH, type: "signup" }));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: TOKEN_HASH });
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/profile/setup?next=%2F&confirmed=1");
    expect(response.headers.get("Set-Cookie")).toContain("sb-project-auth-token=session-value");
  });

  it("sends a returning grower with a profile to the page they asked for, still signed in", async () => {
    verifySucceeds();
    findProfile.mockResolvedValue({ id: USER_ID });
    const response = await GET(
      confirmUrl({ token_hash: TOKEN_HASH, type: "signup", next: "/capture" }),
    );
    expect(response.headers.get("Location")).toBe("/capture");
    expect(response.headers.get("Set-Cookie")).toContain("sb-project-auth-token");
  });

  it("refuses an expired or already-used link with the sign-in notice, and sets no session", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: "otp_expired" } });
    const response = await GET(confirmUrl({ token_hash: TOKEN_HASH, type: "signup" }));
    expect(response.headers.get("Location")).toBe("/sign-in?confirm=expired");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("refuses a malformed link without contacting Supabase", async () => {
    const response = await GET(confirmUrl({ token_hash: "short", type: "signup" }));
    expect(response.headers.get("Location")).toBe("/sign-in?confirm=invalid");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("refuses an unknown link type without contacting Supabase", async () => {
    const response = await GET(confirmUrl({ token_hash: TOKEN_HASH, type: "email_change" }));
    expect(response.headers.get("Location")).toBe("/sign-in?confirm=invalid");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("never redirects off this site, even when the link asks for another address", async () => {
    verifySucceeds();
    findProfile.mockResolvedValue({ id: USER_ID });
    const response = await GET(
      confirmUrl({ token_hash: TOKEN_HASH, type: "signup", next: "//attacker.example/steal" }),
    );
    expect(response.headers.get("Location")).toBe("/");
  });

  it("sends an invitation to password setting and a recovery to the new-password page", async () => {
    verifySucceeds();
    findProfile.mockResolvedValue({ id: USER_ID });
    const invite = await GET(confirmUrl({ token_hash: TOKEN_HASH, type: "invite" }));
    expect(invite.headers.get("Location")).toBe("/auth/set-password?next=%2F");
    const recovery = await GET(confirmUrl({ token_hash: TOKEN_HASH, type: "recovery" }));
    expect(recovery.headers.get("Location")).toBe("/auth/reset-password");
  });

  it("never writes the token or the session value to the log", async () => {
    verifySucceeds();
    findProfile.mockResolvedValue(null);
    await GET(confirmUrl({ token_hash: TOKEN_HASH, type: "signup" }));
    const logged = JSON.stringify(logEvent.mock.calls);
    expect(logged).not.toContain(TOKEN_HASH);
    expect(logged).not.toContain("session-value");
  });
});
