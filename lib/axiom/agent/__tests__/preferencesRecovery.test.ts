import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { axiomOrgPreferences: { findUnique: m.find } } }));
import { applyDispositionPolicy, applyRiskTolerance, loadPreferences } from "../preferences";
import { ApprovalPolicy, RiskTolerance } from "../../enums";
import type { ExecutionPlanItem } from "../../executionPlan";
beforeEach(() => { m.find.mockReset(); m.find.mockResolvedValue(null); });
it("does not share mutable fallback preferences between tenants", async () => {
  const one = await loadPreferences("one"), two = await loadPreferences("two");
  one.ignoredFindingTitles.add("only-one");
  one.preferredProviders.push("aws");
  one.priorityCategories.push("security");
  expect(two.ignoredFindingTitles.size).toBe(0);
  expect(two.preferredProviders).toEqual([]);
  expect(two.priorityCategories).toEqual([]);
  const fresh = await loadPreferences("three");
  expect(fresh.ignoredFindingTitles.size).toBe(0);
});
it("unknown recovered approval policy never preserves automatic execution eligibility", async () => {
  const prefs = await loadPreferences("one");
  prefs.approvalPolicy = "legacy_unknown" as ApprovalPolicy;
  prefs.autoApplyEnabled = true;
  expect(applyDispositionPolicy("auto_fix_candidate", { riskLevel: "low" } as ExecutionPlanItem, prefs)).toBe("approval_required");
  expect(applyDispositionPolicy("blocked", { riskLevel: "low" } as ExecutionPlanItem, prefs)).toBe("blocked");
});
it("unknown risk tolerance takes the conservative path", () => {
  expect(applyRiskTolerance("auto_fix_candidate", "high", "legacy_unknown" as RiskTolerance)).toBe("report_only");
  expect(applyRiskTolerance("auto_fix_candidate", "medium", "legacy_unknown" as RiskTolerance)).toBe("approval_required");
});
it("normalizes malformed stored authority settings without rewriting the row", async () => {
  m.find.mockResolvedValue({ approvalPolicy: "legacy_unknown", riskTolerance: "legacy_unknown", autoApplyEnabled: "false" });
  const prefs = await loadPreferences("one");
  expect(prefs.approvalPolicy).toBe(ApprovalPolicy.RequireAll);
  expect(prefs.riskTolerance).toBe(RiskTolerance.Conservative);
  expect(prefs.autoApplyEnabled).toBe(false);
});
it("preserves explicit recognized policy choices and tighter existing dispositions", async () => {
  const prefs = await loadPreferences("one");
  prefs.approvalPolicy = ApprovalPolicy.AutoSafe; prefs.autoApplyEnabled = true;
  expect(applyDispositionPolicy("auto_fix_candidate", { riskLevel: "low" } as ExecutionPlanItem, prefs)).toBe("auto_fix_candidate");
  expect(applyDispositionPolicy("report_only", { riskLevel: "low" } as ExecutionPlanItem, prefs)).toBe("report_only");
});
