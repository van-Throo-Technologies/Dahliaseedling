import { describe, expect, it } from "vitest";
import { displayedName, FORMER_GROWER_NAME } from "./former-grower";

describe("displayedName", () => {
  it("shows the localized label for the stored former-grower name, in any language", () => {
    expect(FORMER_GROWER_NAME).toBe("Former grower");
    expect(displayedName("Former grower", "Voormalige kweker")).toBe("Voormalige kweker");
    expect(displayedName("Former grower", "Ancien cultivateur")).toBe("Ancien cultivateur");
  });

  it("leaves every other name unchanged, including near matches", () => {
    expect(displayedName("Former growers", "X")).toBe("Former growers");
    expect(displayedName("former grower", "X")).toBe("former grower");
    expect(displayedName("Ada", "X")).toBe("Ada");
  });
});
