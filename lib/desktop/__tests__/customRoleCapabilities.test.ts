// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { CAPABILITY_CATALOG, restrictCapabilities, validateCustomRole } from "../customRoleCapabilities";
import { DESKTOP_CAPABILITIES } from "../desktopAuthorization";

describe("custom role capabilities", () => {
  it("mirrors the desktop capability list exactly", () => {
    expect(CAPABILITY_CATALOG.map((c) => c.id)).toEqual([...DESKTOP_CAPABILITIES]);
  });
  it("only removes", () => {
    expect(restrictCapabilities(["a", "b", "c"], ["b", "z"])).toEqual(["a", "c"]);
  });
  it("validates names and known capabilities, ordering them like the catalog", () => {
    expect(validateCustomRole({ name: " Release op ", removedCapabilities: ["deploy:production_bypass", "agent:approve", "agent:approve"] })).toEqual({ ok: true, role: { name: "Release op", description: "", removedCapabilities: ["agent:approve", "deploy:production_bypass"] } });
    expect(validateCustomRole({ name: "", removedCapabilities: ["agent:approve"] })).toEqual({ ok: false, error: "name_invalid" });
    expect(validateCustomRole({ name: "x", removedCapabilities: ["root:all"] })).toEqual({ ok: false, error: "capability_unknown" });
    expect(validateCustomRole({ name: "x", removedCapabilities: [] })).toEqual({ ok: false, error: "nothing_removed" });
  });
});
