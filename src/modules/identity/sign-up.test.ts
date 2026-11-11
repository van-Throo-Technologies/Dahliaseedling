import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_FORM_STATE } from "./form-state";

/*
 * Open self-registration. The sign-up action runs with its real module. The database client, the request and navigation are replaced.
 * An ordinary registration with a valid address and password must reach Supabase sign-up. Invalid input must stop before Supabase. A
 * refusal from Supabase must map to the right message.
 *
 * The compatibility checks confirm that sign-up is the only path that creates an account with a password, so invitation acceptance,
 * password recovery and sign-in are not changed by it.
 */

const signUp = vi.hoisted(() => vi.fn());
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

const { signUpAction } = await import("./actions");

const EMAIL = "grower@example.test";
const PASSWORD = "correct-horse-battery";

function signUpForm(email = EMAIL, password = PASSWORD): FormData {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}

describe("open self-registration", () => {
  beforeEach(() => {
    signUp.mockReset();
    createClient.mockClear();
    logEvent.mockClear();
  });

  it("sends a valid registration to Supabase sign-up", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    await signUpAction(IDLE_FORM_STATE, signUpForm());
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
  });

  it("asks a new grower to confirm their address when confirmation is on", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    const result = await signUpAction(IDLE_FORM_STATE, signUpForm());
    expect(result).toEqual({ status: "saved", message: "identity.signUp.saved" });
  });

  it("maps a Supabase signup_disabled refusal to the invitation-only message", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "signup_disabled" },
    });
    const result = await signUpAction(IDLE_FORM_STATE, signUpForm());
    expect(result).toMatchObject({ status: "error", message: "identity.signUp.invitationOnly" });
  });

  it("maps any other Supabase refusal to the generic message", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "weak_password" },
    });
    const result = await signUpAction(IDLE_FORM_STATE, signUpForm());
    expect(result).toMatchObject({ status: "error", message: "identity.signUp.genericError" });
  });

  it("stops an invalid address before Supabase is called", async () => {
    const result = await signUpAction(IDLE_FORM_STATE, signUpForm("not-an-address"));
    expect(result).toMatchObject({ status: "error" });
    expect(createClient).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("stops a short password before Supabase is called", async () => {
    const result = await signUpAction(IDLE_FORM_STATE, signUpForm(EMAIL, "short"));
    expect(result).toMatchObject({ status: "error" });
    expect(createClient).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("invitation and recovery compatibility", () => {
  const actionsFile = "src/modules/identity/actions.ts";
  const actionsText = readFileSync(actionsFile, "utf8");

  function bodyOf(name: string): string {
    const start = actionsText.indexOf(`export async function ${name}`);
    expect(start, name).toBeGreaterThan(-1);
    const next = actionsText.indexOf("export async function", start + 1);
    return actionsText.slice(start, next === -1 ? undefined : next);
  }

  it("calls Supabase sign-up in exactly one place: signUpAction", () => {
    const callers = execSync("grep -rln 'auth.signUp(' src", { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter((file) => file.length > 0 && !file.endsWith(".test.ts"));
    expect(callers).toEqual([actionsFile]);
    expect(bodyOf("signUpAction")).toContain("auth.signUp(");
  });

  it("leaves sign-in, invitation password setting, recovery and onboarding without a sign-up call", () => {
    for (const name of [
      "signInAction",
      "setPasswordAction",
      "requestPasswordResetAction",
      "setRecoveredPasswordAction",
      "createProfileAction",
    ]) {
      expect(bodyOf(name), name).not.toContain("auth.signUp(");
    }
  });
});
