import { describe, expect, it } from "vitest";
import {
  LIMITS,
  validateAvatar,
  validateEmail,
  validatePassword,
  validateProfileInput,
} from "./validation";

function formOf(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

describe("validateEmail", () => {
  it("normalises case and surrounding spaces", () => {
    expect(validateEmail("  Grower@Example.COM ")).toEqual({
      ok: true,
      value: "grower@example.com",
    });
  });

  it("rejects empty and malformed addresses", () => {
    expect(validateEmail("")).toMatchObject({ ok: false });
    expect(validateEmail("not-an-email")).toMatchObject({ ok: false });
    expect(validateEmail(null)).toMatchObject({ ok: false });
  });
});

describe("validatePassword", () => {
  it("requires the minimum length", () => {
    expect(validatePassword("short")).toMatchObject({
      ok: false,
      fieldErrors: { password: expect.objectContaining({ key: "validation.password.min" }) },
    });
    expect(validatePassword("long-enough-1")).toEqual({ ok: true, value: "long-enough-1" });
  });

  it("rejects passwords longer than bcrypt can use", () => {
    expect(validatePassword("é".repeat(40))).toMatchObject({ ok: false });
    expect(LIMITS.passwordMaxBytes).toBe(72);
  });
});

describe("validateProfileInput", () => {
  const valid = {
    displayName: "  Janine  ",
    countryCode: "nl",
    regionCity: "",
    bio: "",
    accountTypeLabel: "",
  };

  it("trims values, normalises the country code and turns blanks into null", () => {
    const result = validateProfileInput(formOf(valid));
    expect(result).toEqual({
      ok: true,
      value: {
        displayName: "Janine",
        countryCode: "NL",
        regionCity: null,
        bio: null,
        accountTypeLabel: null,
      },
    });
  });

  it("requires a display name between the limits", () => {
    expect(validateProfileInput(formOf({ ...valid, displayName: "A" }))).toMatchObject({
      ok: false,
      fieldErrors: {
        displayName: expect.objectContaining({ key: "validation.displayName.range" }),
      },
    });
    expect(
      validateProfileInput(
        formOf({ ...valid, displayName: "x".repeat(LIMITS.displayNameMax + 1) }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("requires a country from the ISO list", () => {
    expect(validateProfileInput(formOf({ ...valid, countryCode: "" }))).toMatchObject({
      ok: false,
      fieldErrors: { countryCode: { key: "validation.country.choose" } },
    });
    expect(validateProfileInput(formOf({ ...valid, countryCode: "UK" }))).toMatchObject({
      ok: false,
    });
  });

  it("accepts only the listed account presentation labels", () => {
    expect(validateProfileInput(formOf({ ...valid, accountTypeLabel: "breeder" }))).toMatchObject({
      ok: true,
      value: { accountTypeLabel: "breeder" },
    });
    expect(validateProfileInput(formOf({ ...valid, accountTypeLabel: "admin" }))).toMatchObject({
      ok: false,
      fieldErrors: { accountTypeLabel: { key: "validation.accountType.choose" } },
    });
  });

  it("limits bio and region length", () => {
    expect(
      validateProfileInput(formOf({ ...valid, bio: "x".repeat(LIMITS.bioMax + 1) })),
    ).toMatchObject({ ok: false });
    expect(
      validateProfileInput(formOf({ ...valid, regionCity: "x".repeat(LIMITS.regionCityMax + 1) })),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe("validateAvatar", () => {
  it("treats a missing or empty file as no change", () => {
    expect(validateAvatar(null)).toEqual({ ok: true, value: null });
    expect(validateAvatar(new File([], "empty.png", { type: "image/png" }))).toEqual({
      ok: true,
      value: null,
    });
  });

  it("accepts JPEG, PNG and WebP up to the size limit", () => {
    const file = new File(["x"], "photo.webp", { type: "image/webp" });
    expect(validateAvatar(file)).toEqual({ ok: true, value: file });
  });

  it("rejects other types and oversize files", () => {
    expect(validateAvatar(new File(["x"], "doc.pdf", { type: "application/pdf" }))).toMatchObject({
      ok: false,
    });
    expect(validateAvatar(new File(["x"], "gif.gif", { type: "image/gif" }))).toMatchObject({
      ok: false,
    });
    const big = new File([new Uint8Array(LIMITS.avatarMaxBytes + 1)], "big.png", {
      type: "image/png",
    });
    expect(validateAvatar(big)).toMatchObject({ ok: false });
  });
});
