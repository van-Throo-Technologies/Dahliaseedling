import { describe, expect, it } from "vitest";
import { validateProfileInput } from "./validation";

function form(displayName: string): FormData {
  const data = new FormData();
  data.set("displayName", displayName);
  data.set("countryCode", "NL");
  data.set("regionCity", "");
  data.set("bio", "");
  data.set("accountTypeLabel", "");
  return data;
}

describe("the former-grower name is reserved in the profile form", () => {
  it.each(["Former grower", "former grower", "  FORMER GROWER  "])("refuses %j", (name) => {
    const result = validateProfileInput(form(name));
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : Object.keys(result.fieldErrors)).toContain("displayName");
  });

  it("accepts an ordinary grower who names themselves in a similar way", () => {
    const result = validateProfileInput(form("Former growers club"));
    expect(result.ok ? undefined : result.fieldErrors.displayName).toBeUndefined();
  });
});
