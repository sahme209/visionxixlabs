import { describe, expect, it } from "vitest";
import { parseManagedPolicy, workspaceAllowed } from "../../../desktop/src/lib/managedPolicy";

const found = (contents: string) => ({ status: "found" as const, path: "/etc/v19/policy.json", contents });

describe("managed policy", () => {
  it("no file means a personal install", () => {
    const s = parseManagedPolicy({ status: "none" });
    expect(s).toEqual({ kind: "none" });
    expect(workspaceAllowed(s, "org_a")).toBe("allowed");
  });
  it("reads managedBy, allowed workspaces and update notices", () => {
    const s = parseManagedPolicy(found(JSON.stringify({ managedBy: " Example Health IT ", allowedWorkspaceIds: ["org_a", "org_a", "org_b"], updateNotices: false })));
    expect(s).toEqual({ kind: "ok", path: "/etc/v19/policy.json", policy: { managedBy: "Example Health IT", allowedWorkspaceIds: ["org_a", "org_b"], updateNotices: false } });
    expect(workspaceAllowed(s, "org_b")).toBe("allowed");
    expect(workspaceAllowed(s, "org_x")).toBe("not_allowed");
  });
  it("defaults update notices on and allows any workspace when no list is set", () => {
    const s = parseManagedPolicy(found("{}"));
    expect(s.kind === "ok" && s.policy).toEqual({ managedBy: null, allowedWorkspaceIds: null, updateNotices: true });
    expect(workspaceAllowed(s, "anything")).toBe("allowed");
  });
  it("fails closed on anything it does not understand", () => {
    for (const bad of ["not json", "[]", JSON.stringify({ allowedWorkspaceIds: [] }), JSON.stringify({ allowedWorkspaceIds: ["bad id!"] }), JSON.stringify({ updateNotices: "no" }), JSON.stringify({ managedBy: "" }), JSON.stringify({ allowWorkspaces: ["org_a"] })]) {
      const s = parseManagedPolicy(found(bad));
      expect(s.kind, bad).toBe("invalid");
      expect(workspaceAllowed(s, "org_a")).toBe("policy_invalid");
    }
    expect(parseManagedPolicy({ status: "invalid", path: "p", reason: "too_large" })).toEqual({ kind: "invalid", path: "p", reason: "too_large" });
  });
});
