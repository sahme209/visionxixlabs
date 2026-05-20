/**
 * Vitest unit tests for the pure SCIM lifecycle helper.
 */

import { describe, it, expect } from "vitest";
import { computeLifecyclePlan, type CurrentGrant, type DirectoryEmployee } from "../scimLifecycleHelper";

const E = (id: string, status: DirectoryEmployee["status"], desiredRoles: string[], email = `${id}@example.com`): DirectoryEmployee =>
  ({ id, email, status, desiredRoles });
const G = (userId: string, role: string): CurrentGrant =>
  ({ userId, role, grantedAtIso: "2026-01-01T00:00:00Z" });

describe("scimLifecycleHelper", () => {
  it("empty input → empty plan", () => {
    const r = computeLifecyclePlan({ employees: [], currentGrants: [] });
    expect(r.actions).toEqual([]);
    expect(r.joinersCount).toBe(0);
  });

  it("joiner → grant_role for each desired role", () => {
    const r = computeLifecyclePlan({
      employees: [E("alice", "active", ["engineer", "oncall"])],
      currentGrants: [],
    });
    expect(r.joinersCount).toBe(1);
    expect(r.actions.filter((a) => a.kind === "grant_role").length).toBe(2);
  });

  it("mover → grant + revoke deltas", () => {
    const r = computeLifecyclePlan({
      employees: [E("alice", "active", ["engineer", "tech_lead"])],
      currentGrants: [G("alice", "engineer"), G("alice", "intern")],
    });
    expect(r.actions.some((a) => a.kind === "grant_role" && a.role === "tech_lead")).toBe(true);
    expect(r.actions.some((a) => a.kind === "revoke_role" && a.role === "intern")).toBe(true);
    expect(r.moversCount).toBe(1);
  });

  it("terminated → revoke every grant + deactivate", () => {
    const r = computeLifecyclePlan({
      employees: [E("alice", "terminated", [])],
      currentGrants: [G("alice", "engineer"), G("alice", "oncall")],
    });
    const revokes = r.actions.filter((a) => a.kind === "revoke_role");
    expect(revokes.length).toBe(2);
    expect(r.actions.some((a) => a.kind === "deactivate_user")).toBe(true);
    expect(r.leaversCount).toBe(1);
  });

  it("on_leave → no changes (preserve grants)", () => {
    const r = computeLifecyclePlan({
      employees: [E("alice", "on_leave", ["engineer"])],
      currentGrants: [G("alice", "engineer")],
    });
    expect(r.actions).toEqual([]);
  });

  it("user missing from HRIS → revoke + deactivate (missed offboarding)", () => {
    const r = computeLifecyclePlan({
      employees: [],
      currentGrants: [G("ghost", "admin")],
    });
    expect(r.actions.some((a) => a.kind === "revoke_role" && a.userId === "ghost")).toBe(true);
    expect(r.actions.some((a) => a.kind === "deactivate_user" && a.userId === "ghost")).toBe(true);
    expect(r.leaversCount).toBe(1);
  });

  it("joiner not counted as mover when current grants empty", () => {
    const r = computeLifecyclePlan({
      employees: [E("alice", "active", ["engineer"])],
      currentGrants: [],
    });
    expect(r.joinersCount).toBe(1);
    expect(r.moversCount).toBe(0);
  });

  it("reasons explain each action", () => {
    const r = computeLifecyclePlan({
      employees: [E("alice", "terminated", [])],
      currentGrants: [G("alice", "engineer")],
    });
    expect(r.actions[0].reason).toContain("terminated");
  });
});
