import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The email templates in supabase/email-templates are the source pasted into the hosted Supabase project. Each action link must go to
 * /auth/confirm with its token hash and type, so the server verifies the token before a session is set. The default ConfirmationURL
 * sends the session in the URL fragment, which the server never sees, and must not appear in any template.
 */

const DIR = "supabase/email-templates";

function read(name: string): string {
  return readFileSync(`${DIR}/${name}`, "utf8");
}

const TEMPLATES = [
  { body: ["confirm-signup.html", "confirm-signup.txt"], type: "signup" },
  { body: ["invite.html", "invite.txt"], type: "invite" },
  { body: ["recovery.html", "recovery.txt"], type: "recovery" },
];

describe("email templates", () => {
  for (const { body, type } of TEMPLATES) {
    it(`${body[0]} links to the server-checked confirmation route for type ${type}`, () => {
      for (const file of body) {
        const text = read(file);
        expect(text, file).not.toContain("ConfirmationURL");
        expect(text, file).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}");
        expect(text, file).toMatch(new RegExp(`type=${type}\\b`));
      }
    });
  }

  it("has a subject line for the sign-up confirmation", () => {
    expect(read("confirm-signup-subject.txt").trim()).toBe("Confirm your DahliaSeedling account");
  });

  it("documents the sign-up confirmation template in the README", () => {
    expect(read("README.md")).toContain("confirm-signup.html");
  });
});
