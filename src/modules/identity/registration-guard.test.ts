import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Server-side registration guard. The sign-up action is called with its real module. The database client, the request and navigation are
 * replaced. On the production branch the guard must refuse before any client is created or Supabase is asked to sign anyone up. The
 * positive control runs the same action on a non-production branch, to show that the stubs do reach Supabase.
 *
 * The compatibility checks below confirm that sign-up is the only path that creates an account with a password, so invitation acceptance,
 * password recovery, sign-in and onboarding are not affected by the guard.
 */

const signUp = vi.hoisted(() => vi.fn(async () => ({ data: { user: null }, error: null })));
const createClient = vi.hoisted(() => vi.fn(async () => ({ auth: { signUp } })));
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

import { IDLE_FORM_STATE } from "./form-state";

const { signUpAction } = await import("./actions");

function restoreEnv(previous: { env: string | undefined; ref: string | undefined }): void {
  if (previous.env === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = previous.env;
  if (previous.ref === undefined) delete process.env.VERCEL_GIT_COMMIT_REF;
  else process.env.VERCEL_GIT_COMMIT_REF = previous.ref;
}

const EMAIL = "grower@example.test";
const PASSWORD = "correct-horse-battery";

function signUpForm(): FormData {
  const form = new FormData();
  form.set("email", EMAIL);
  form.set("password", PASSWORD);
  return form;
}

const IDLE = IDLE_FORM_STATE;

describe("sign-up in a production deployment from main", () => {
  let previousEnv: { env: string | undefined; ref: string | undefined };

  beforeEach(() => {
    previousEnv = { env: process.env.VERCEL_ENV, ref: process.env.VERCEL_GIT_COMMIT_REF };
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    signUp.mockClear();
    createClient.mockClear();
    logEvent.mockClear();
  });

  afterEach(() => {
    restoreEnv(previousEnv);
  });

  it("refuses an otherwise valid registration with the invitation-only message", async () => {
    const result = await signUpAction(IDLE, signUpForm());
    expect(result).toMatchObject({ status: "error", message: "identity.signUp.invitationOnly" });
  });

  it("refuses before any Supabase client is created or sign-up is called", async () => {
    await signUpAction(IDLE, signUpForm());
    expect(createClient).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("refuses an invalid form the same way, with no validation detail that could help a caller", async () => {
    const form = new FormData();
    form.set("email", "not-an-address");
    const result = await signUpAction(IDLE, form);
    expect(result).toMatchObject({
      status: "error",
      message: "identity.signUp.invitationOnly",
      fieldErrors: {},
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("logs the refusal with the outcome and no address or password", async () => {
    await signUpAction(IDLE, signUpForm());
    expect(logEvent).toHaveBeenCalledWith("warn", "auth_sign_up", {
      outcome: "refused",
      code: "invitation_only",
      route: "sign-up",
    });
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain(EMAIL);
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain(PASSWORD);
  });
});

describe("sign-up outside production (positive control)", () => {
  let previousEnv: { env: string | undefined; ref: string | undefined };

  beforeEach(() => {
    previousEnv = { env: process.env.VERCEL_ENV, ref: process.env.VERCEL_GIT_COMMIT_REF };
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_REF;
    signUp.mockClear();
    createClient.mockClear();
  });

  afterEach(() => {
    restoreEnv(previousEnv);
  });

  it("reaches Supabase sign-up, so the production refusal is what stopped the earlier test", async () => {
    await signUpAction(IDLE, signUpForm());
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
  });
});

describe("invitation and recovery compatibility", () => {
  const actionsFile = "src/modules/identity/actions.ts";
  const actionsText = readFileSync(actionsFile, "utf8");

  it("calls Supabase sign-up in exactly one place: signUpAction", () => {
    const callers = execSync("grep -rln 'auth.signUp(' src", { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter((file) => file.length > 0 && !file.endsWith(".test.ts"));
    expect(callers).toEqual([actionsFile]);
    const signUpStart = actionsText.indexOf("export async function signUpAction");
    const nextExport = actionsText.indexOf("export async function", signUpStart + 1);
    const callAt = actionsText.indexOf("auth.signUp(");
    expect(callAt).toBeGreaterThan(signUpStart);
    expect(callAt).toBeLessThan(nextExport);
  });

  it("does not call the registration check from the invitation, password, recovery or sign-in actions", () => {
    const names = [
      "signInAction",
      "setPasswordAction",
      "requestPasswordResetAction",
      "setRecoveredPasswordAction",
      "createProfileAction",
    ];
    for (const name of names) {
      const start = actionsText.indexOf(`export async function ${name}`);
      expect(start, name).toBeGreaterThan(-1);
      const next = actionsText.indexOf("export async function", start + 1);
      const body = actionsText.slice(start, next === -1 ? undefined : next);
      expect(body, name).not.toContain("selfRegistrationOpen");
    }
  });

  it("keeps the registration check in the server action, not only in the page", () => {
    const page = readFileSync("src/app/sign-up/page.tsx", "utf8");
    expect(page).not.toContain("selfRegistrationOpen");
    expect(actionsText).toContain("selfRegistrationOpen(process.env)");
  });
});
