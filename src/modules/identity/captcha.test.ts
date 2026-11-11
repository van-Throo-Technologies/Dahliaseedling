import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captchaFailedFrom,
  captchaRequired,
  captchaTokenFrom,
  CAPTCHA_FIELD,
  CAPTCHA_TOKEN_MAX_LENGTH,
} from "./captcha";
import { IDLE_FORM_STATE } from "./form-state";

/*
 * Bot protection on sign-up, sign-in and password reset. With the Turnstile site key configured, each action refuses a request without a
 * token before any Supabase call, and passes the token to Supabase Auth when it is present. Without the key, as in local development, no
 * token is required. Supabase's failed-check code gets its own message.
 */

const signUp = vi.hoisted(() => vi.fn());
const signInWithPassword = vi.hoisted(() => vi.fn());
const resetPasswordForEmail = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() =>
  vi.fn(async () => ({ auth: { signUp, signInWithPassword, resetPasswordForEmail } })),
);
const logEvent = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (location: string) => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("@/i18n/server", () => ({
  getTranslation: async () => ({ locale: "en", t: (key: string) => key, messages: {} }),
  getLocale: async () => "en",
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("@/lib/logging/log", () => ({ logEvent }));

const { signUpAction, signInAction, requestPasswordResetAction } = await import("./actions");

const EMAIL = "grower@example.test";
const PASSWORD = "correct-horse-battery";
const TOKEN = "turnstile-token-from-the-widget";

function form(fields: Record<string, string>, token?: string): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  if (token !== undefined) data.set(CAPTCHA_FIELD, token);
  return data;
}

const SIGN_UP = { email: EMAIL, password: PASSWORD };
const SIGN_IN = { email: EMAIL, password: PASSWORD };
const RESET = { email: EMAIL };

describe("captcha rules", () => {
  it("requires a token only when the public site key is configured", () => {
    expect(captchaRequired({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAA" })).toBe(true);
    expect(captchaRequired({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "   " })).toBe(false);
    expect(captchaRequired({})).toBe(false);
  });

  it("reads a submitted token, and treats an empty or blank field as no token", () => {
    expect(captchaTokenFrom(form({}, TOKEN))).toBe(TOKEN);
    expect(captchaTokenFrom(form({}, "   "))).toBeUndefined();
    expect(captchaTokenFrom(form({}))).toBeUndefined();
  });

  it("treats an oversized value as no token, so it never reaches Supabase", () => {
    expect(captchaTokenFrom(form({}, "t".repeat(CAPTCHA_TOKEN_MAX_LENGTH)))).toBeDefined();
    expect(captchaTokenFrom(form({}, "t".repeat(CAPTCHA_TOKEN_MAX_LENGTH + 1)))).toBeUndefined();
  });

  it("keeps the invitation and password-setting paths free of the bot check", () => {
    const actionsText = readFileSync("src/modules/identity/actions.ts", "utf8");
    const start = actionsText.indexOf("export async function setPasswordAction");
    const next = actionsText.indexOf("export async function", start + 1);
    const setPassword = actionsText.slice(start, next === -1 ? undefined : next);
    expect(setPassword).not.toContain("captcha");
    const confirmRoute = readFileSync("src/app/auth/confirm/route.ts", "utf8");
    expect(confirmRoute).not.toContain("captcha");
  });

  it("recognises Supabase's failed-check code and nothing else", () => {
    expect(captchaFailedFrom("captcha_failed")).toBe(true);
    expect(captchaFailedFrom("signup_disabled")).toBe(false);
    expect(captchaFailedFrom(undefined)).toBe(false);
  });
});

describe("with the Turnstile site key configured", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
    signUp.mockReset();
    signInWithPassword.mockReset();
    resetPasswordForEmail.mockReset();
    createClient.mockClear();
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previousKey;
  });

  it("sign-up refuses a missing token before any Supabase call", async () => {
    const result = await signUpAction(IDLE_FORM_STATE, form(SIGN_UP));
    expect(result).toMatchObject({ status: "error", message: "identity.captcha.missing" });
    expect(createClient).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("sign-up passes the token to Supabase as captchaToken", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    await signUpAction(IDLE_FORM_STATE, form(SIGN_UP, TOKEN));
    expect(signUp).toHaveBeenCalledWith({ ...SIGN_UP, options: { captchaToken: TOKEN } });
  });

  it("sign-up reports an expired, reused or invalid token with the failed-check message", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "captcha_failed" },
    });
    const result = await signUpAction(IDLE_FORM_STATE, form(SIGN_UP, TOKEN));
    expect(result).toMatchObject({ status: "error", message: "identity.captcha.failed" });
  });

  it("sign-in refuses a missing token before any Supabase call", async () => {
    const result = await signInAction(IDLE_FORM_STATE, form(SIGN_IN));
    expect(result).toMatchObject({ status: "error", message: "identity.captcha.missing" });
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("sign-in passes the token to Supabase as captchaToken", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    await signInAction(IDLE_FORM_STATE, form(SIGN_IN, TOKEN));
    expect(signInWithPassword).toHaveBeenCalledWith({
      ...SIGN_IN,
      options: { captchaToken: TOKEN },
    });
  });

  it("sign-in reports a failed check differently from wrong credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "captcha_failed" } });
    const result = await signInAction(IDLE_FORM_STATE, form(SIGN_IN, TOKEN));
    expect(result).toMatchObject({ status: "error", message: "identity.captcha.failed" });
  });

  it("password reset refuses a missing token before any Supabase call", async () => {
    const result = await requestPasswordResetAction(IDLE_FORM_STATE, form(RESET));
    expect(result).toMatchObject({ status: "error", message: "identity.captcha.missing" });
    expect(createClient).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("password reset passes the token to Supabase as captchaToken and still says the same thing either way", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await requestPasswordResetAction(IDLE_FORM_STATE, form(RESET, TOKEN));
    expect(resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, { captchaToken: TOKEN });
    expect(result).toMatchObject({ status: "saved" });
  });

  it("password reset reports a failed check without revealing whether the account exists", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: "captcha_failed" } });
    const result = await requestPasswordResetAction(IDLE_FORM_STATE, form(RESET, TOKEN));
    expect(result).toMatchObject({ status: "error", message: "identity.captcha.failed" });
  });
});

describe("without the Turnstile site key (local development and tests)", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    signUp.mockReset();
    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = previousKey;
  });

  it("sign-up proceeds without a token, and sends no captcha token", async () => {
    const result = await signUpAction(IDLE_FORM_STATE, form(SIGN_UP));
    expect(result).toEqual({ status: "saved", message: "identity.signUp.saved" });
    expect(signUp).toHaveBeenCalledWith({ ...SIGN_UP, options: { captchaToken: undefined } });
  });
});
