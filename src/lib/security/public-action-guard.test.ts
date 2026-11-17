import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_ACTIONS } from "./public-surface";

/*
 * Negative security tests for the public action guard. Each server action is called with its real module, and the database client, the
 * request headers and navigation are replaced. On the public surface, a guarded action must stop at the guard: no client is created and
 * no business logic runs. The positive control runs the same actions without the public surface, to show that the stubs do reach the
 * business logic, so a refusal in the public case means the guard refused it.
 */

const dbTouched = vi.hoisted(() => vi.fn());

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
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    dbTouched();
    throw new Error("DB_TOUCHED");
  },
}));

const modules = {
  "src/i18n/actions.ts": () => import("@/i18n/actions"),
  "src/modules/seedlings/merge.ts": () => import("@/modules/seedlings/merge"),
  "src/modules/seedlings/actions.ts": () => import("@/modules/seedlings/actions"),
  "src/modules/privacy/actions.ts": () => import("@/modules/privacy/actions"),
  "src/modules/capture/actions.ts": () => import("@/modules/capture/actions"),
  "src/modules/rehome/actions.ts": () => import("@/modules/rehome/actions"),
  "src/modules/identity/actions.ts": () => import("@/modules/identity/actions"),
  "src/modules/publications/actions.ts": () => import("@/modules/publications/actions"),
  "src/modules/admin/actions.ts": () => import("@/modules/admin/actions"),
  "src/modules/feedback/actions.ts": () => import("@/modules/feedback/actions"),
  "src/modules/seeds/actions.ts": () => import("@/modules/seeds/actions"),
  "src/modules/notifications/actions.ts": () => import("@/modules/notifications/actions"),
  "src/modules/messaging/actions.ts": () => import("@/modules/messaging/actions"),
  "src/modules/invitations/actions.ts": () => import("@/modules/invitations/actions"),
};

async function allActions() {
  const found: { file: string; name: string; fn: (...args: unknown[]) => Promise<unknown> }[] = [];
  for (const [file, load] of Object.entries(modules)) {
    const mod = (await load()) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value === "function") found.push({ file, name, fn: value as never });
    }
  }
  return found;
}

beforeEach(() => {
  dbTouched.mockClear();
});

afterEach(() => {
  delete process.env.PUBLIC_SURFACE;
});

describe("on the public surface, every guarded action stops at the guard", () => {
  it("refuses each non-journey action before any database client is created", async () => {
    process.env.PUBLIC_SURFACE = "invitations";
    const actions = await allActions();
    const guarded = actions.filter((action) => !PUBLIC_ACTIONS.includes(action.name));
    expect(guarded.length).toBe(58);

    for (const action of guarded) {
      dbTouched.mockClear();
      await expect(action.fn(new FormData()), `${action.file} ${action.name}`).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(dbTouched, `${action.name} reached the database`).not.toHaveBeenCalled();
    }
  });

  it("refuses an administrator decision even when it is sent with an administrator-looking form", async () => {
    process.env.PUBLIC_SURFACE = "invitations";
    const { decideInvitationRequestAction } = await import("@/modules/invitations/actions");
    const form = new FormData();
    form.set("requestId", "00000000-0000-0000-0000-000000000000");
    form.set("decision", "approve");
    await expect(decideInvitationRequestAction(form)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(dbTouched).not.toHaveBeenCalled();
  });
});

describe("positive control: the same actions reach the business logic without the public surface", () => {
  it("runs a guarded action's own logic when the public surface is off", async () => {
    const { decideInvitationRequestAction } = await import("@/modules/invitations/actions");
    const form = new FormData();
    form.set("requestId", "not-a-uuid");
    form.set("decision", "approve");
    // The request id is invalid, so the action redirects with an error code before it reaches the database. It is still past the guard.
    await expect(decideInvitationRequestAction(form)).rejects.toThrow("NEXT_REDIRECT");
    expect(dbTouched).not.toHaveBeenCalled();

    const { markNotificationReadAction } = await import("@/modules/notifications/actions");
    await expect(markNotificationReadAction(new FormData())).rejects.toThrow("DB_TOUCHED");
    expect(dbTouched).toHaveBeenCalled();
  });
});
