import { describe, expect, it } from "vitest";
import type { ApprovalPolicyDef } from "@/lib/axiom/agent/rbacEngine";
import { replayPolicies, type HistoricalAction } from "../replayKernel";

const policy = (over: Partial<ApprovalPolicyDef>): ApprovalPolicyDef => ({ id: "p", organizationId: "org", name: "Rule", enabled: true, priority: 10, matchRiskLevels: [], matchActionTypes: [], matchProviders: [], matchCategories: [], requiredApprovals: 1, requiredRoles: [], escalateToRoles: [], blockAction: false, ...over });
const action = (id: string, riskLevel: string, day = 1): HistoricalAction => ({ id, title: `Action ${id}`, createdAt: new Date(Date.UTC(2026, 10, day)), status: "applied", riskLevel: riskLevel as HistoricalAction["riskLevel"], actionType: "rightsize" as HistoricalAction["actionType"], provider: "aws" as HistoricalAction["provider"], disposition: "safe_to_automate" as HistoricalAction["disposition"], yearlyHigh: 1000 });
const window = { from: new Date(Date.UTC(2026, 9, 1)), to: new Date(Date.UTC(2026, 10, 30)) };

describe("policy replay kernel", () => {
  it("reports no changes when the draft equals the current policies", () => {
    const p = [policy({ name: "Two for high", matchRiskLevels: ["high" as never], requiredApprovals: 2 })];
    const r = replayPolicies({ current: p, draft: p, history: [action("1", "high"), action("2", "low")], ...window });
    expect(r.changes).toEqual([]);
    expect(r.window.actions).toBe(2);
    expect(r.totals.before).toEqual(r.totals.after);
  });

  it("counts actions a draft would newly block, and marks them stricter", () => {
    const draft = [policy({ name: "Block high", matchRiskLevels: ["high" as never], blockAction: true, priority: 100 })];
    const r = replayPolicies({ current: [], draft, history: [action("1", "high"), action("2", "high", 2), action("3", "low", 3)], ...window });
    expect(r.newlyBlocked).toBe(2);
    expect(r.stricter).toBeGreaterThanOrEqual(2);
    expect(r.changes.map((c) => c.id)).toEqual(expect.arrayContaining(["1", "2"]));
    expect(r.changes.find((c) => c.id === "1")).toMatchObject({ after: "blocked", afterPolicy: "Block high" });
  });

  it("counts actions a draft would auto-approve, and marks them looser", () => {
    const current = [policy({ name: "Approve all", requiredApprovals: 1, priority: 1 })];
    const draft = [policy({ name: "Auto low", matchRiskLevels: ["low" as never], requiredApprovals: 0, priority: 50 }), ...current];
    const r = replayPolicies({ current, draft, history: [action("1", "low"), action("2", "high")], ...window });
    expect(r.newlyAutoApproved).toBe(1);
    expect(r.looser).toBe(1);
    expect(r.changes).toHaveLength(1);
  });

  it("skips category-specific rules instead of widening them, and says so", () => {
    const draft = [policy({ name: "Security only", matchCategories: ["security" as never], blockAction: true, priority: 100 })];
    const r = replayPolicies({ current: [], draft, history: [action("1", "high")], ...window });
    expect(r.newlyBlocked).toBe(0);
    expect(r.limits[0]).toContain("Security only");
  });

  it("caps the change list but keeps exact totals", () => {
    const draft = [policy({ name: "Block all", blockAction: true, priority: 100 })];
    const history = Array.from({ length: 30 }, (_, i) => action(String(i), "medium", (i % 28) + 1));
    const r = replayPolicies({ current: [], draft, history, ...window, maxChanges: 5 });
    expect(r.changes).toHaveLength(5);
    expect(r.totals.after.blocked).toBe(30);
    expect(r.newlyBlocked).toBe(30);
  });
});
