import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The installable app's contract. The manifest is a static file in public/, so it is served as-is. Its colours must match the design
 * tokens, which are the single source for hex values. The check reads the tokens file; no hex literal is written in this test.
 */

const ROOT = process.cwd();
const TOKENS = readFileSync(join(ROOT, "src/design-system/tokens.css"), "utf8");

function token(name: string): string | null {
  const match = TOKENS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return match ? match[1]!.toLowerCase() : null;
}

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(join(ROOT, path));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const manifest = JSON.parse(readFileSync(join(ROOT, "public/manifest.webmanifest"), "utf8")) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};

describe("the web app manifest is valid and installable", () => {
  it("has a name, a short name, a start URL inside its scope, and standalone display", () => {
    expect(manifest.name).toBe("DahliaSeedling");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("uses the design tokens for its theme and background colours", () => {
    expect(manifest.theme_color).toBe(token("ds-aubergine"));
    expect(manifest.background_color).toBe(token("ds-porcelain"));
  });

  it("has 192 and 512 pixel icons, one of them maskable, and each file is the size it declares", () => {
    expect(manifest.icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const declared = icon.sizes.split("x").map(Number);
      expect(icon.type).toBe("image/png");
      const actual = pngSize(join("public", icon.src));
      expect([actual.width, actual.height]).toEqual(declared);
    }
  });

  it("serves the Apple touch icon at 180 pixels", () => {
    expect(pngSize("public/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });
});

describe("no service worker or offline cache is registered", () => {
  it("nothing in the application registers a service worker or a cache", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .filter((file) => !file.endsWith("pwa.test.ts"))
      .filter((file) => /serviceWorker|CacheStorage|caches\.open/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
