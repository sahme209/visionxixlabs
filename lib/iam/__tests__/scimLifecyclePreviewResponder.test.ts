import { describe, expect, it } from "vitest";
import { buildScimLifecyclePreviewResponse } from "../scimLifecyclePreviewResponder";

describe("buildScimLifecyclePreviewResponse", () => {
  it("422 invalid_payload when employees is missing/malformed", async () => {
    const r = buildScimLifecyclePreviewResponse({ employees: "not an array", currentGrants: [] });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("invalid_payload");
  });

  it("422 invalid_payload when an employee is missing required fields", async () => {
    const r = buildScimLifecyclePreviewResponse({ employees: [{ id: "e1" }], currentGrants: [] });
    expect(r.status).toBe(422);
  });

  it("422 invalid_payload when currentGrants is malformed", async () => {
    const r = buildScimLifecyclePreviewResponse({
      employees: [{ id: "e1", email: "a@acme.com", status: "active", desiredRoles: ["admin"] }],
      currentGrants: [{ userId: "e1" }],
    });
    expect(r.status).toBe(422);
  });

  it("computes a real lifecycle plan for valid input", async () => {
    const r = buildScimLifecyclePreviewResponse({
      employees: [{ id: "e1", email: "a@acme.com", status: "active", desiredRoles: ["admin"] }],
      currentGrants: [],
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.joinersCount).toBe(1);
    expect(r.body.data.actions).toHaveLength(1);
    expect(r.body.data.actions[0]).toMatchObject({ kind: "grant_role", userId: "e1", role: "admin" });
  });

  it("stages a revoke + deactivate for a terminated employee", async () => {
    const r = buildScimLifecyclePreviewResponse({
      employees: [{ id: "e1", email: "a@acme.com", status: "terminated", desiredRoles: [] }],
      currentGrants: [{ userId: "e1", role: "admin", grantedAtIso: "2026-01-01T00:00:00Z" }],
    });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.leaversCount).toBe(1);
    expect(r.body.data.actions.some((a) => a.kind === "revoke_role")).toBe(true);
    expect(r.body.data.actions.some((a) => a.kind === "deactivate_user")).toBe(true);
  });
});
