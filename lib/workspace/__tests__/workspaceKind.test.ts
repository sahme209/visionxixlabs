import { describe, it, expect } from "vitest";
import {
  resolveWorkspaceKind,
  isSandboxWorkspace,
  isRealWorkspace,
  assertNotDemoLeak,
  DemoLeakError,
  workspaceKindLabel,
  SANDBOX_WORKSPACE_ID,
} from "../workspaceKind";

describe("resolveWorkspaceKind", () => {
  it("recognizes the sandbox prefix", () => {
    expect(resolveWorkspaceKind("ws_sandbox_public_demo")).toBe("sandbox");
    expect(resolveWorkspaceKind("ws_sandbox_anything")).toBe("sandbox");
  });

  it("recognizes the internal prefix", () => {
    expect(resolveWorkspaceKind("ws_internal_admin_visionxixlabs")).toBe("internal");
    expect(resolveWorkspaceKind("ws_internal_eval_runner")).toBe("internal");
  });

  it("treats every other id as real (defense in depth)", () => {
    expect(resolveWorkspaceKind("ws_acme")).toBe("real");
    expect(resolveWorkspaceKind("ws_growth_corp")).toBe("real");
    expect(resolveWorkspaceKind("clr1a2b3c4d")).toBe("real"); // cuid-style
    expect(resolveWorkspaceKind("")).toBe("real"); // even empty → real to fail safe
  });

  it("does NOT match 'sandbox' as a substring (must be a prefix)", () => {
    expect(resolveWorkspaceKind("ws_acme_sandbox_team")).toBe("real");
    expect(resolveWorkspaceKind("sandbox_ws_demo")).toBe("real");
  });
});

describe("isSandboxWorkspace / isRealWorkspace", () => {
  it("predicates are mutually exclusive", () => {
    expect(isSandboxWorkspace("ws_sandbox_x")).toBe(true);
    expect(isRealWorkspace("ws_sandbox_x")).toBe(false);
    expect(isSandboxWorkspace("ws_acme")).toBe(false);
    expect(isRealWorkspace("ws_acme")).toBe(true);
  });

  it("internal is neither sandbox nor real", () => {
    expect(isSandboxWorkspace("ws_internal_x")).toBe(false);
    expect(isRealWorkspace("ws_internal_x")).toBe(false);
  });
});

describe("assertNotDemoLeak", () => {
  it("throws DemoLeakError when called on a real workspace", () => {
    expect(() => assertNotDemoLeak("ws_acme", "TestSurface")).toThrow(DemoLeakError);
  });

  it("does not throw for sandbox workspaces", () => {
    expect(() => assertNotDemoLeak("ws_sandbox_x", "TestSurface")).not.toThrow();
  });

  it("does not throw for internal workspaces", () => {
    expect(() => assertNotDemoLeak("ws_internal_x", "TestSurface")).not.toThrow();
  });

  it("error includes the surface name + org id for audit triage", () => {
    try {
      assertNotDemoLeak("ws_acme", "DashboardDemoCards");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DemoLeakError);
      const err = e as DemoLeakError;
      expect(err.organizationId).toBe("ws_acme");
      expect(err.surfaceName).toBe("DashboardDemoCards");
      expect(err.message).toContain("ws_acme");
      expect(err.message).toContain("DashboardDemoCards");
    }
  });
});

describe("workspaceKindLabel", () => {
  it("returns operator-friendly labels for every kind", () => {
    expect(workspaceKindLabel("real").label).toBe("Live workspace");
    expect(workspaceKindLabel("sandbox").label).toContain("Sandbox");
    expect(workspaceKindLabel("internal").label).toContain("Internal");
  });

  it("descriptions warn the user about live billing impact", () => {
    expect(workspaceKindLabel("real").description).toMatch(/billing|production/i);
    expect(workspaceKindLabel("sandbox").description).toMatch(/example|nothing is billed/i);
  });
});

describe("SANDBOX_WORKSPACE_ID", () => {
  it("starts with the sandbox prefix so the kernel agrees", () => {
    expect(resolveWorkspaceKind(SANDBOX_WORKSPACE_ID)).toBe("sandbox");
  });
});
