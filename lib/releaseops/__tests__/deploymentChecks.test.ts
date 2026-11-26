import { describe, expect, it } from "vitest";
import { stageCoverage, validateCheck } from "../deploymentChecks";

const base = { key: "health-probe", name: "Health probe", kind: "smoke_test", stage: "verify", mode: "blocking" } as const;
describe("deployment checks", () => {
  it("validates each kind's spec strictly", () => {
    expect(validateCheck({ ...base, spec: { url: "https://app.example.invalid/health", expectStatus: 200, maxLatencyMs: 500 } }).ok).toBe(true);
    const bad = validateCheck({ ...base, spec: { url: "http://app.example.invalid/health", expectStatus: 200, maxLatencyMs: 500 } });
    expect(bad.ok).toBe(false);
    expect(validateCheck({ ...base, kind: "custom_script", spec: { scriptPath: "../etc/passwd", runner: "github_actions" } }).ok).toBe(false);
    expect(validateCheck({ ...base, kind: "custom_script", spec: { scriptPath: "/abs/x.sh", runner: "github_actions" } }).ok).toBe(false);
    expect(validateCheck({ ...base, kind: "custom_script", spec: { scriptPath: "scripts/smoke.sh", runner: "github_actions" } }).ok).toBe(true);
    expect(validateCheck({ ...base, kind: "manual_checklist", spec: { items: [] } }).ok).toBe(false);
    expect(validateCheck({ ...base, kind: "manual_checklist", spec: { items: ["Status page updated"], extra: 1 } }).ok).toBe(false);
    expect(validateCheck({ ...base, key: "Bad Key", spec: {} }).ok).toBe(false);
    expect(validateCheck({ ...base, kind: "security_scan", spec: { tool: "Trivy", maxCritical: 0, maxHigh: 3 } }).ok).toBe(true);
    expect(validateCheck({ ...base, kind: "security_scan", spec: { tool: "Trivy", maxCritical: -1, maxHigh: 3 } }).ok).toBe(false);
    expect(validateCheck({ ...base, kind: "supply_chain", spec: { evidence: "sbom_and_provenance", verifier: "slsa-verifier" } }).ok).toBe(true);
    expect(validateCheck({ ...base, kind: "supply_chain", spec: { evidence: "signature", verifier: "x" } }).ok).toBe(false);
  });
  it("summarizes enabled checks per stage in lifecycle order and lists uncovered stages", () => {
    const c = (stage: string, mode: "blocking" | "advisory", enabled = true) => ({ key: stage + mode, name: "x", kind: "smoke_test" as const, stage: stage as "verify", mode, enabled, version: 1 });
    const out = stageCoverage([c("verify", "blocking"), c("verify", "advisory"), c("validate", "blocking"), c("deploy", "blocking", false)]);
    expect(out.stages.map((s) => s.stage)).toEqual(["plan", "validate", "approve", "deploy", "verify", "recover"]);
    expect(out.stages[4]).toEqual({ stage: "verify", blocking: 1, advisory: 1 });
    expect(out.uncovered).toEqual(["plan", "approve", "deploy", "recover"]);
  });
});
