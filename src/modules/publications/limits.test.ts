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

  it("keeps HEIC and HEIF private, because the bundled decoder cannot read the HEVC encoding", () => {
    expect(isPubliclyShareable("image/heic")).toBe(false);
    expect(isPubliclyShareable("image/heif")).toBe(false);
  });

  it("explains the HEIC limit in words that do not claim the photo was lost", () => {
    const explanation = MESSAGES.en.publication.publish.privateOnly;
    expect(explanation).toContain("stay private");
    expect(explanation).not.toMatch(/lost|deleted/i);
  });
});
