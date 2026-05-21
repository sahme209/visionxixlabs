import { describe, it, expect, beforeEach } from "vitest";
import {
  planOnboarding,
  __resetOnboardingCounter,
  type NewHire,
} from "../hrOnboardingPlanner";

function hire(overrides: Partial<NewHire> = {}): NewHire {
  return {
    id: "emp-2026-0042",
    fullName: "Sam Test",
    workEmail: "sam@example.com",
    roleFamily: "engineering",
    employmentType: "fte",
    startDate: "2026-06-01",
    workLocation: "remote",
    managerEmail: "mgr@example.com",
    requiresElevatedAccess: false,
    ...overrides,
  };
}

beforeEach(() => __resetOnboardingCounter());

describe("planOnboarding", () => {
  it("happy path → ready + spans 4 phases", () => {
    const p = planOnboarding(hire());
    const phases = new Set(p.tasks.map((t) => t.phase));
    expect(phases.has("pre_start")).toBe(true);
    expect(phases.has("day_one")).toBe(true);
    expect(phases.has("week_one")).toBe(true);
    expect(phases.has("month_one")).toBe(true);
    expect(p.readiness).toBe("ready");
  });

  it("missing required fields → blocked", () => {
    expect(planOnboarding(hire({ fullName: "" })).readiness).toBe("blocked");
    expect(planOnboarding(hire({ workEmail: "" })).readiness).toBe("blocked");
    expect(planOnboarding(hire({ startDate: "" })).readiness).toBe("blocked");
  });

  it("intern + elevated access → blocked (refuse)", () => {
    const p = planOnboarding(hire({ employmentType: "intern", requiresElevatedAccess: true }));
    expect(p.readiness).toBe("blocked");
    expect(p.rationale).toMatch(/Intern/i);
  });

  it("elevated access for FTE → needs_review + a security task fires", () => {
    const p = planOnboarding(hire({ requiresElevatedAccess: true }));
    expect(p.readiness).toBe("needs_review");
    expect(p.tasks.some((t) => t.owner === "security" && t.riskTier === "high")).toBe(true);
  });

  it("remote hires get a ship-laptop task", () => {
    const p = planOnboarding(hire({ workLocation: "remote" }));
    expect(p.tasks.some((t) => t.title.toLowerCase().includes("ship laptop"))).toBe(true);
  });

  it("onsite hires get a stage-laptop task instead of ship", () => {
    const p = planOnboarding(hire({ workLocation: "onsite" }));
    expect(p.tasks.some((t) => t.title.toLowerCase().includes("stage laptop"))).toBe(true);
  });

  it("interns skip the payroll task", () => {
    const p = planOnboarding(hire({ employmentType: "intern" }));
    expect(p.tasks.some((t) => /payroll/i.test(t.title))).toBe(false);
  });

  it("non-interns get the payroll task", () => {
    const p = planOnboarding(hire({ employmentType: "fte" }));
    expect(p.tasks.some((t) => /payroll/i.test(t.title))).toBe(true);
  });

  it("role-specific tooling differs by role family", () => {
    const eng   = planOnboarding(hire({ roleFamily: "engineering" }));
    const sales = planOnboarding(hire({ roleFamily: "sales" }));
    const engDetails = eng.tasks.map((t) => t.detail).join(" ");
    const salesDetails = sales.tasks.map((t) => t.detail).join(" ");
    expect(engDetails).toMatch(/GitHub|VPN/);
    expect(salesDetails).toMatch(/CRM/);
  });

  it("overall risk reflects the highest task", () => {
    const elevated = planOnboarding(hire({ requiresElevatedAccess: true }));
    expect(elevated.overallRiskTier).toBe("high");
    const routine = planOnboarding(hire({ requiresElevatedAccess: false }));
    expect(routine.overallRiskTier).toBe("medium"); // payroll task is medium-risk
  });

  it("day_one tasks have dayOffset=0", () => {
    const p = planOnboarding(hire());
    const day1 = p.tasks.filter((t) => t.phase === "day_one");
    expect(day1.length).toBeGreaterThan(0);
    for (const t of day1) expect(t.dayOffset).toBe(0);
  });

  it("pre_start tasks have negative dayOffset", () => {
    const p = planOnboarding(hire());
    const pre = p.tasks.filter((t) => t.phase === "pre_start");
    for (const t of pre) expect(t.dayOffset).toBeLessThan(0);
  });
});
