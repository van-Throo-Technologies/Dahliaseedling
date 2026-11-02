import { describe, expect, it } from "vitest";
import { CAPTURE_LIMITS, extensionForMime, kindForMime, maxBytesFor } from "./limits";
import { matchVoiceCommand } from "./voice";
import {
  buildUploadPath,
  fileProblem,
  validateNote,
  validateObservedAt,
  validateSeedlingChoice,
  validateSelection,
  validateUploadPaths,
} from "./validation";

const OWNER = "11111111-2222-4333-8444-555555555555";
const FILE = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const NOW = new Date("2026-11-01T10:00:00.000Z");

describe("limits and media types", () => {
  it("classifies photos and videos, and rejects everything else", () => {
    expect(kindForMime("image/jpeg")).toBe("image");
    expect(kindForMime("image/heic")).toBe("image");
    expect(kindForMime("video/quicktime")).toBe("video");
    expect(kindForMime("application/pdf")).toBeNull();
  });

  it("sets per-type size limits: 15 MB for photos, 50 MB for videos", () => {
    expect(maxBytesFor("image/png")).toBe(15 * 1024 * 1024);
    expect(maxBytesFor("video/mp4")).toBe(50 * 1024 * 1024);
    expect(maxBytesFor("text/plain")).toBeNull();
  });

  it("gives every allowed type a file extension", () => {
    expect(extensionForMime("video/quicktime")).toBe("mov");
    expect(extensionForMime("text/plain")).toBeNull();
  });
});

describe("file problems", () => {
  it("accepts an ordinary photo and an ordinary short video", () => {
    expect(fileProblem({ name: "a.jpg", type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(fileProblem({ name: "v.mp4", type: "video/mp4", size: 20_000_000 })).toBeNull();
  });

  it("refuses an unsupported type, an oversize photo, an oversize video and an empty file", () => {
    expect(fileProblem({ name: "x.txt", type: "text/plain", size: 10 })).toContain("not supported");
    expect(
      fileProblem({ name: "p.jpg", type: "image/jpeg", size: CAPTURE_LIMITS.imageMaxBytes + 1 }),
    ).toContain("15 MB");
    expect(
      fileProblem({ name: "v.mp4", type: "video/mp4", size: CAPTURE_LIMITS.videoMaxBytes + 1 }),
    ).toContain("50 MB");
    expect(fileProblem({ name: "e.jpg", type: "image/jpeg", size: 0 })).toBe("That file is empty.");
  });

  it("limits a capture to the configured number of files", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      name: `${i}.jpg`,
      type: "image/jpeg",
      size: 100,
    }));
    expect(validateSelection(six).ok).toBe(true);
    expect(validateSelection([...six, { name: "7.jpg", type: "image/jpeg", size: 100 }]).ok).toBe(
      false,
    );
    expect(validateSelection([]).ok).toBe(false);
  });
});

describe("upload paths", () => {
  it("builds {owner}/{uuid}.{ext} paths", () => {
    expect(buildUploadPath(OWNER, "image/jpeg", FILE)).toBe(`${OWNER}/${FILE}.jpg`);
    expect(buildUploadPath("not-a-uuid", "image/jpeg", FILE)).toBeNull();
  });

  it("accepts only paths inside the signed-in grower's own folder", () => {
    expect(validateUploadPaths(JSON.stringify([`${OWNER}/${FILE}.jpg`]), OWNER).ok).toBe(true);
    const other = "99999999-8888-4777-8666-555555555555";
    expect(validateUploadPaths(JSON.stringify([`${other}/${FILE}.jpg`]), OWNER).ok).toBe(false);
  });

  it("refuses malformed, traversing, duplicated and unsupported paths", () => {
    expect(validateUploadPaths("not json", OWNER).ok).toBe(false);
    expect(validateUploadPaths(JSON.stringify(["../etc/passwd"]), OWNER).ok).toBe(false);
    expect(validateUploadPaths(JSON.stringify([`${OWNER}/${FILE}.exe`]), OWNER).ok).toBe(false);
    expect(
      validateUploadPaths(JSON.stringify([`${OWNER}/${FILE}.jpg`, `${OWNER}/${FILE}.jpg`]), OWNER)
        .ok,
    ).toBe(false);
    expect(validateUploadPaths(JSON.stringify([]), OWNER).ok).toBe(false);
  });
});

describe("note and observed time", () => {
  it("keeps an empty note as null and enforces the length limit", () => {
    expect(validateNote("   ")).toEqual({ ok: true, value: null });
    expect(validateNote("x".repeat(CAPTURE_LIMITS.noteMaxLength + 1)).ok).toBe(false);
  });

  it("uses the time you save when no time is given", () => {
    expect(validateObservedAt("", NOW)).toEqual({ ok: true, value: null });
  });

  it("accepts an earlier time and refuses a future one beyond the allowed skew", () => {
    expect(validateObservedAt("2026-10-30T09:15", NOW).ok).toBe(true);
    expect(validateObservedAt("2026-11-01T10:03", NOW).ok).toBe(true);
    expect(validateObservedAt("2026-11-02T10:00", NOW).ok).toBe(false);
    expect(validateObservedAt("not a date", NOW).ok).toBe(false);
  });
});

describe("where the capture goes", () => {
  it("needs a valid seedling for an existing choice, and an identifier for an identifier choice", () => {
    expect(validateSeedlingChoice("new", "", "")).toEqual({ ok: true, value: { mode: "new" } });
    expect(validateSeedlingChoice("existing", OWNER, "").ok).toBe(true);
    expect(validateSeedlingChoice("existing", "nope", "").ok).toBe(false);
    expect(validateSeedlingChoice("identifier", "", "#12")).toEqual({
      ok: true,
      value: { mode: "identifier", identifier: "12" },
    });
    expect(validateSeedlingChoice("identifier", "", "  ").ok).toBe(false);
  });
});

describe("voice command", () => {
  it("recognises 'New seedling' regardless of case and punctuation", () => {
    expect(matchVoiceCommand("New seedling.")).toBe("new_seedling");
    expect(matchVoiceCommand("new seedling")).toBe("new_seedling");
    expect(matchVoiceCommand("  NEW SEEDLING, please")).toBe("new_seedling");
  });

  it("ignores everything else, so dictated notes are never treated as commands", () => {
    expect(matchVoiceCommand("the seedling looks new")).toBeNull();
    expect(matchVoiceCommand("not keeping this one")).toBeNull();
    expect(matchVoiceCommand("")).toBeNull();
  });
});
