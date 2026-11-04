import { describe, expect, it } from "vitest";
import { accountFailure } from "./account-failure";

describe("accountFailure", () => {
  it("maps each refusal to its stable key", () => {
    expect(accountFailure({ code: "42501", message: "not allowed" })).toBe("notAllowed");
    expect(accountFailure({ code: "P0002", message: "profile not found" })).toBe("notFound");
    expect(accountFailure({ code: "23514", message: "you cannot suspend your own account" })).toBe(
      "ownAccount",
    );
    expect(
      accountFailure({ code: "23514", message: "a reason of 10 to 500 characters is required" }),
    ).toBe("reason");
  });

  it("falls back to a generic key for anything unrecognised, without echoing it", () => {
    expect(accountFailure({ code: "XX000", message: "internal detail" })).toBe("generic");
    expect(accountFailure(null)).toBe("generic");
  });
});
