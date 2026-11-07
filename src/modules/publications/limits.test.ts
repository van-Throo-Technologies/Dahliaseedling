import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import { isPubliclyShareable, PUBLIC_URL_SECONDS } from "./limits";

describe("publication limits", () => {
  it("keeps public image links to one hour", () => {
    expect(PUBLIC_URL_SECONDS).toBe(3600);
  });

  it("allows JPEG, PNG and WebP to be published", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(isPubliclyShareable(mime)).toBe(true);
    }
  });

  it("allows HEIC and HEIF to be published, because they are decoded when they are shared", () => {
    expect(isPubliclyShareable("image/heic")).toBe(true);
    expect(isPubliclyShareable("image/heif")).toBe(true);
  });

  it("keeps video and unknown types out of public sharing", () => {
    expect(isPubliclyShareable("video/mp4")).toBe(false);
    expect(isPubliclyShareable("application/octet-stream")).toBe(false);
  });

  it("explains a refusal in words that do not claim the photo was lost", () => {
    const explanations = [
      [MESSAGES.en.publication.publish.privateOnly, "private"],
      [MESSAGES.nl.publication.publish.privateOnly, "privé"],
      [MESSAGES.fr.publication.publish.privateOnly, "privé"],
    ] as const;
    for (const [explanation, stays] of explanations) {
      expect(explanation).toContain(stays);
      expect(explanation).not.toMatch(/lost|deleted|perdu|supprimé|verloren|gelöscht/i);
    }
  });
});
