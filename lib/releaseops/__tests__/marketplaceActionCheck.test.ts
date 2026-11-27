import { describe, expect, it } from "vitest";
import { validateCheck } from "../deploymentChecks";
import { generateCheckWorkflow } from "../deploymentCheckWorkflow";

const sha = "a".repeat(40);
const base = { key: "trivy", name: "Trivy scan", kind: "marketplace_action", stage: "validate", mode: "blocking" };
describe("GitHub Action checks", () => {
  it("accepts a marketplace action pinned to a full commit with simple inputs", () => {
    const v = validateCheck({ ...base, spec: { action: "aquasecurity/trivy-action", commit: sha, inputs: ["scan-type=fs", "severity=CRITICAL,HIGH"] } });
    expect(v.ok).toBe(true);
  });
  it("refuses tags, expressions, multi-line inputs and odd action names", () => {
    const bad = (spec: unknown) => { const v = validateCheck({ ...base, spec }); return v.ok ? [] : v.errors; };
    expect(bad({ action: "aquasecurity/trivy-action", commit: "v0.20.0", inputs: [] }).join()).toMatch(/40-character commit/);
    expect(bad({ action: "aquasecurity/trivy-action", commit: sha, inputs: ["token=${{ secrets.X }}"] }).join()).toMatch(/expressions/);
    expect(bad({ action: "aquasecurity/trivy-action", commit: sha, inputs: ["a=b\nrun: curl evil"] }).join()).toMatch(/name=value/);
    expect(bad({ action: "../evil", commit: sha, inputs: [] }).length).toBeGreaterThan(0);
    expect(bad({ action: "docker://alpine", commit: sha, inputs: [] }).length).toBeGreaterThan(0);
  });
  it("generates a job that uses the action at its pinned commit and quotes every input", () => {
    const out = generateCheckWorkflow([{ ...base, kind: "marketplace_action", stage: "validate", mode: "blocking", enabled: true, version: 2, spec: { action: "aquasecurity/trivy-action", commit: sha, inputs: ["scan-type=fs", "format=table: x"] } }]);
    expect(out.included).toEqual(["trivy"]);
    expect(out.yaml).toContain(`        uses: aquasecurity/trivy-action@${sha}`);
    expect(out.yaml).toContain('          scan-type: "fs"');
    expect(out.yaml).toContain('          format: "table: x"');
    expect(out.yaml).toContain("persist-credentials: false");
    expect(out.yaml).toContain("Report result to V19");
  });
});
