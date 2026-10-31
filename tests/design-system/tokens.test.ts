import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SRC = join(ROOT, "src");
const TOKENS_FILE = join(SRC, "design-system", "tokens.css");

/** Locked brand palette: Design System & UI Brief v1.0, section 2. */
const LOCKED_PALETTE = {
  "--ds-aubergine": "#382733",
  "--ds-apricot": "#f29b72",
  "--ds-plum": "#8b6177",
  "--ds-porcelain": "#fbf7f1",
  "--ds-sand": "#e8ddd2",
  "--ds-charcoal": "#29272a",
};

function readTokens(): Record<string, string> {
  const css = readFileSync(TOKENS_FILE, "utf8");
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/(--ds-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) {
      tokens[name] = value.toLowerCase();
    }
  }
  return tokens;
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = channelLuminance(parseInt(hex.slice(1, 3), 16));
  const g = channelLuminance(parseInt(hex.slice(3, 5), 16));
  const b = channelLuminance(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(css|ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("design tokens", () => {
  const tokens = readTokens();

  it("defines every locked brand colour with the exact specified HEX value", () => {
    for (const [name, hex] of Object.entries(LOCKED_PALETTE)) {
      expect(tokens[name], name).toBe(hex);
    }
  });

  it("keeps raw HEX values out of every file except tokens.css", () => {
    const offenders = listSourceFiles(SRC)
      .filter((file) => file !== TOKENS_FILE)
      .filter((file) => /#[0-9a-fA-F]{6}\b/.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));

    expect(offenders).toEqual([]);
  });
});

describe("semantic colour contrast (WCAG AA)", () => {
  const tokens = readTokens();
  const get = (name: string): string => {
    const value = tokens[name];
    if (value === undefined) throw new Error(`missing token ${name}`);
    return value;
  };

  // Text pairs must reach 4.5:1 (AA normal text).
  const textPairs: Array<[string, string, string]> = [
    ["charcoal text on porcelain background", "--ds-charcoal", "--ds-porcelain"],
    ["aubergine brand text on porcelain background", "--ds-aubergine", "--ds-porcelain"],
    ["plum muted text on porcelain background", "--ds-plum", "--ds-porcelain"],
    ["plum muted text on white surface", "--ds-plum", "--ds-white"],
    ["aubergine text on apricot primary action", "--ds-aubergine", "--ds-apricot"],
    ["white text on destructive", "--ds-white", "--ds-destructive"],
    ["destructive text on porcelain", "--ds-destructive", "--ds-porcelain"],
  ];

  it.each(textPairs)("%s", (_label, foreground, background) => {
    expect(contrast(get(foreground), get(background))).toBeGreaterThanOrEqual(4.5);
  });

  // Non-text UI (focus rings, control boundaries) must reach 3:1 (WCAG 1.4.11).
  it("gives the focus ring at least 3:1 against the background", () => {
    expect(contrast(get("--ds-aubergine"), get("--ds-porcelain"))).toBeGreaterThanOrEqual(3);
  });

  // Documents a known trap: apricot must never be used as text, and white on apricot fails.
  it("rejects white text on apricot, so primary actions use dark text", () => {
    expect(contrast(get("--ds-white"), get("--ds-apricot"))).toBeLessThan(4.5);
  });
});
