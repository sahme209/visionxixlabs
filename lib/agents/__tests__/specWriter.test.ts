import { describe, it, expect, beforeEach } from "vitest";
import { draftSpec, __resetSpecCounter, type SpecKind } from "../specWriter";

beforeEach(() => __resetSpecCounter());

describe("specWriter", () => {
  it("requires a non-empty problem", () => {
    expect(() => draftSpec({ problem: "" })).toThrow();
    expect(() => draftSpec({ problem: "   " })).toThrow();
  });

  it("classifies a bug fix when problem mentions a regression", () => {
    const s = draftSpec({ problem: "Login is broken on Safari — token fails to parse." });
    expect(s.kind).toBe<SpecKind>("bug_fix");
    expect(s.verification.some((v) => /regression/i.test(v))).toBe(true);
  });

  it("classifies a feature request", () => {
    const s = draftSpec({ problem: "Add SCIM provisioning support for the enterprise tier." });
    expect(s.kind).toBe<SpecKind>("feature");
    expect(s.goals.length).toBeGreaterThan(0);
  });

  it("classifies a refactor", () => {
    const s = draftSpec({ problem: "Refactor the auth middleware to extract role checks into pure helpers." });
    expect(s.kind).toBe<SpecKind>("refactor");
    expect(s.nonGoals.some((g) => /behavior/i.test(g))).toBe(true);
  });

  it("classifies a migration and includes a high-risk dual-write entry", () => {
    const s = draftSpec({ problem: "Migrate the users table — rename column email_addr to email." });
    expect(s.kind).toBe<SpecKind>("migration");
    expect(s.risks.some((r) => r.tier === "high")).toBe(true);
    expect(s.rollback).toMatch(/reverse migration/i);
  });

  it("falls back to investigation when no keywords match", () => {
    const s = draftSpec({ problem: "We saw something odd in the logs around 03:47 UTC last night." });
    expect(s.kind).toBe<SpecKind>("investigation");
    expect(s.rollback).toMatch(/read-only/i);
  });

  it("titles are short — never exceed 80 chars", () => {
    const long = "Login is broken on Safari and Chrome and Firefox and probably every other browser when the user has an expired session cookie that hasn't been rotated in the last 30 days.";
    const s = draftSpec({ problem: long });
    expect(s.title.length).toBeLessThanOrEqual(80);
  });

  it("summary is under 160 chars and includes the kind", () => {
    const s = draftSpec({ problem: "Add SCIM provisioning for enterprise tenants.".repeat(3) });
    expect(s.summary.length).toBeLessThanOrEqual(160);
    expect(s.summary.toLowerCase()).toContain("feature");
  });

  it("escalates expectedNextAgents to include boundary_gate for migrations", () => {
    const s = draftSpec({ problem: "Migrate the orders table to a partitioned schema." });
    expect(s.expectedNextAgents).toContain("boundary_gate");
  });

  it("escalates expectedNextAgents to include boundary_gate when prod is mentioned", () => {
    const s = draftSpec({ problem: "Fix a customer-facing crash in the production checkout flow." });
    expect(s.expectedNextAgents).toContain("boundary_gate");
  });

  it("low-impact refactors do not pull in boundary_gate", () => {
    const s = draftSpec({ problem: "Refactor the logger helper to use closed-union levels." });
    expect(s.expectedNextAgents).not.toContain("boundary_gate");
  });

  it("issues sequential ids on the in-process counter", () => {
    const a = draftSpec({ problem: "Refactor x." });
    const b = draftSpec({ problem: "Refactor y." });
    expect(a.id).toBe("spec-1");
    expect(b.id).toBe("spec-2");
  });

  it("data-loss language gets a critical-tier risk", () => {
    const s = draftSpec({ problem: "Drop the audit table — this will cause data loss if rolled back wrong." });
    expect(s.risks.some((r) => r.tier === "critical")).toBe(true);
  });
});
