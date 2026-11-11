import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/i18n/messages";

/*
 * The personal landing page at /join. It is public and must not depend on the invitation-request switch. Its wording is the approved
 * English copy, and its social preview is the 1200 × 630 image cut from the approved photograph.
 */

function lookup(key: string): string {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)[part],
      MESSAGES.en,
    ) as string;
}

vi.mock("server-only", () => ({}));
vi.mock("@/i18n/server", () => ({
  getTranslation: async () => ({ locale: "en", t: lookup, messages: MESSAGES.en }),
  getLocale: async () => "en",
}));

const { generateMetadata } = await import("./page");

describe("personal landing page metadata", () => {
  it("uses the approved title and a shareable description", async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe("How DahliaSeedling began");
    expect(String(meta.description)).toContain(
      "what happens to the seedlings growers decide not to keep",
    );
  });

  it("sets Open Graph and Twitter preview metadata with a 1200 × 630 image", async () => {
    const meta = await generateMetadata();
    const og = meta.openGraph as {
      images: { url: string; width: number; height: number }[];
      title: string;
    };
    expect(og.title).toBe("How DahliaSeedling began");
    expect(og.images[0]).toMatchObject({ url: "/images/og-join.jpg", width: 1200, height: 630 });
    const twitter = meta.twitter as { card: string; images: string[] };
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.images).toEqual(["/images/og-join.jpg"]);
  });

  it("resolves absolute social URLs against the site, not the request host", async () => {
    const meta = await generateMetadata();
    expect(String(meta.metadataBase)).toMatch(/^https:\/\//);
  });

  it("has the social preview image and the approved photograph in public/images", () => {
    expect(existsSync("public/images/og-join.jpg")).toBe(true);
    expect(existsSync("public/images/founder-seedling.jpg")).toBe(true);
  });
});

describe("personal landing page", () => {
  const source = readFileSync("src/app/(letter)/join/page.tsx", "utf8");

  it("is public: it no longer depends on the invitation-request switch", () => {
    expect(source).not.toContain("INVITATION_REQUESTS_ENABLED");
    expect(source).not.toContain("notFound");
  });

  it("links the primary call to sign-up and the secondary text link to the feed", () => {
    expect(source).toContain('href="/sign-up"');
    expect(source).toContain('href="/"');
  });

  it("has no sign-in link: existing members sign in through the application", () => {
    expect(source).not.toContain("/sign-in");
  });

  it("no longer offers the invitation-request form", () => {
    expect(source).not.toContain("InvitationRequestForm");
  });
});

describe("the letter's frame", () => {
  it("is not wrapped in the application shell, which carries the navigation and footer", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).not.toContain("AppShell");
    expect(readFileSync("src/app/(letter)/layout.tsx", "utf8")).not.toContain("AppShell");
    expect(readFileSync("src/app/(app)/layout.tsx", "utf8")).toContain("AppShell");
  });

  it("the letter's own frame has no navigation, sign-in or account controls", () => {
    const frame = readFileSync("src/app/(letter)/layout.tsx", "utf8");
    expect(frame).not.toMatch(/PrimaryNav|AppHeader|AppFooter|sign-in|Notifications|Profile/);
  });
});

describe("approved English copy", () => {
  it("matches the approved wording for the calls to action and the sign-off", () => {
    expect(lookup("landing.kicker")).toBe("A personal note from Janine");
    expect(lookup("landing.primaryCta")).toBe("Join me on DahliaSeedling");
    expect(lookup("landing.secondaryCta")).toBe("Or have a look around first");
    expect(lookup("landing.signature")).toBe("— Janine");
  });

  it("keeps the approved closing paragraphs word for word", () => {
    expect(lookup("landing.p5")).toBe("That's where the idea for DahliaSeedling came from.");
    expect(lookup("landing.p10")).toBe("I'd love to see where we can take this together.");
  });
});
