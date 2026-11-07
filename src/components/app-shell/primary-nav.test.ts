import { describe, expect, it } from "vitest";
import { isActive } from "./primary-nav";

describe("which navigation destination is current", () => {
  it("marks Home only on the Feed itself", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/capture", "/")).toBe(false);
    expect(isActive("/profile", "/")).toBe(false);
  });

  it("marks Capture only inside the capture page", () => {
    expect(isActive("/capture", "/capture")).toBe(true);
    expect(isActive("/capture/", "/capture")).toBe(true);
    expect(isActive("/", "/capture")).toBe(false);
  });

  it("marks Notifications on the notifications page", () => {
    expect(isActive("/notifications", "/notifications")).toBe(true);
    expect(isActive("/", "/notifications")).toBe(false);
  });

  it("marks Profile on the grower's profile and its management pages", () => {
    expect(isActive("/profile", "/profile")).toBe(true);
    expect(isActive("/profile/edit", "/profile")).toBe(true);
    expect(isActive("/profiles/abc", "/profile")).toBe(false);
  });

  it("does not mark Profile during profile setup, the onboarding step a new grower is sent through", () => {
    expect(isActive("/profile/setup", "/profile")).toBe(false);
    expect(isActive("/profile/setup/", "/profile")).toBe(false);
  });
});
