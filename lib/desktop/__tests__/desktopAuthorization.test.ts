import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { capabilitiesForRole, hasDesktopCapability } from "../desktopAuthorization";

describe("desktop workspace authorization", () => {
  it("allows operators to use governed GitHub and deployment paths without admin controls", () => {
    expect(capabilitiesForRole("operator")).toEqual(expect.arrayContaining(["github:write", "deploy:execute"]));
    expect(hasDesktopCapability("operator", "policy:manage")).toBe(false);
    expect(hasDesktopCapability("operator", "deploy:production_bypass")).toBe(false);
  });

  it("lets security reviewers decide proposals without write or deploy authority", () => {
    expect(hasDesktopCapability("security_reviewer", "agent:approve")).toBe(true);
    expect(hasDesktopCapability("security_reviewer", "github:write")).toBe(false);
    expect(hasDesktopCapability("security_reviewer", "deploy:execute")).toBe(false);
  });

  it("reserves emergency production bypass for owners and admins", () => {
    expect(hasDesktopCapability("owner", "deploy:production_bypass")).toBe(true);
    expect(hasDesktopCapability("admin", "deploy:production_bypass")).toBe(true);
    expect(hasDesktopCapability("read_only", "deploy:production_bypass")).toBe(false);
  });
});
