import { describe, expect, it } from "vitest";
import { INVITATION_LIMITS, isHoneypotFilled, validateInvitationRequest } from "./validation";

const VALID = {
  name: "Anna de Vries",
  countryCode: "NL",
  email: "Anna@Example.nl",
  reason: "I grow dahlias from seed and want to share real plants.",
};

describe("invitation request validation", () => {
  it("accepts a complete request and normalises the email and country", () => {
    const result = validateInvitationRequest(VALID);
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Anna de Vries",
        countryCode: "NL",
        email: "anna@example.nl",
        reason: "I grow dahlias from seed and want to share real plants.",
      },
    });
  });

  it("accepts a name and reason at the exact limits", () => {
    const name = "a".repeat(INVITATION_LIMITS.nameMax);
    const reason = "r".repeat(INVITATION_LIMITS.reasonMax);
    expect(validateInvitationRequest({ ...VALID, name, reason }).ok).toBe(true);
  });

  it("refuses a name or reason one character outside the limits", () => {
    const tooShortName = validateInvitationRequest({ ...VALID, name: "A" });
    expect(tooShortName.ok).toBe(false);
    const tooLongName = validateInvitationRequest({ ...VALID, name: "a".repeat(81) });
    expect(tooLongName.ok).toBe(false);
    const tooShortReason = validateInvitationRequest({ ...VALID, reason: "too short" });
    expect(tooShortReason.ok).toBe(false);
    const tooLongReason = validateInvitationRequest({ ...VALID, reason: "r".repeat(501) });
    expect(tooLongReason.ok).toBe(false);
  });

  it("counts characters, not bytes, so accented names are measured fairly", () => {
    expect(validateInvitationRequest({ ...VALID, name: "Zoë" }).ok).toBe(true);
    expect(validateInvitationRequest({ ...VALID, name: "é" }).ok).toBe(false);
  });

  it("refuses a country that is not a current ISO code", () => {
    expect(validateInvitationRequest({ ...VALID, countryCode: "" }).ok).toBe(false);
    expect(validateInvitationRequest({ ...VALID, countryCode: "UK" }).ok).toBe(false);
    expect(validateInvitationRequest({ ...VALID, countryCode: "XX" }).ok).toBe(false);
  });

  it("refuses a malformed email, and one longer than the database allows", () => {
    expect(validateInvitationRequest({ ...VALID, email: "not-an-email" }).ok).toBe(false);
    expect(validateInvitationRequest({ ...VALID, email: "a b@example.nl" }).ok).toBe(false);
    const long = `${"a".repeat(245)}@example.nl`;
    expect(validateInvitationRequest({ ...VALID, email: long }).ok).toBe(false);
  });

  it("refuses control characters in free text, but allows line breaks in the reason", () => {
    expect(validateInvitationRequest({ ...VALID, name: "Anna\u0007" }).ok).toBe(false);
    expect(
      validateInvitationRequest({
        ...VALID,
        reason: "Line one of my reason.\nLine two follows here.",
      }).ok,
    ).toBe(true);
  });

  it("reports every invalid field at once, by key, without echoing the input", () => {
    const result = validateInvitationRequest({ name: "", countryCode: "", email: "", reason: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      "countryCode",
      "email",
      "name",
      "reason",
    ]);
    expect(result.fieldErrors.email).toEqual({ key: "invitations.errors.email" });
  });
});

describe("honeypot", () => {
  it("flags only a filled honeypot field", () => {
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled("")).toBe(false);
    expect(isHoneypotFilled("   ")).toBe(false);
    expect(isHoneypotFilled("https://spam.example")).toBe(true);
  });
});
