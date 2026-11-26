import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { generateCheckWorkflow, type GeneratableCheck } from "../deploymentCheckWorkflow";
import { validateCheck } from "../deploymentChecks";

const c = (over: Partial<GeneratableCheck>): GeneratableCheck => ({ key: "health-probe", name: "Health probe", kind: "smoke_test", stage: "verify", mode: "blocking", enabled: true, version: 3, spec: { url: "https://app.example.invalid/health", expectStatus: 200, maxLatencyMs: 500 }, ...over });

describe("generateCheckWorkflow", () => {
  it("produces valid YAML with one job per CI-runnable check and explains skipped ones", () => {
    const out = generateCheckWorkflow([
      c({}),
      c({ key: "smoke-script", name: "Script", kind: "custom_script", mode: "advisory", spec: { scriptPath: "scripts/smoke.sh", runner: "github_actions" } }),
      c({ key: "runbook", name: "Manual", kind: "manual_checklist", spec: { items: ["x"] } }),
      c({ key: "errors", name: "Errors", kind: "health_check", spec: { metric: "m", comparison: "below", threshold: 1, windowMinutes: 5 } }),
      c({ key: "off", enabled: false }),
    ]);
    const doc = parseDocument(out.yaml); expect(doc.errors).toEqual([]);
    const js = doc.toJS() as { jobs: Record<string, { env: Record<string, string>; "continue-on-error"?: boolean }>; permissions: unknown };
    expect(Object.keys(js.jobs).sort()).toEqual(["check_health_probe", "check_smoke_script"]);
    expect(js.jobs.check_health_probe.env).toMatchObject({ V19_CHECK_KEY: "health-probe", V19_CHECK_VERSION: "3", CHECK_URL: "https://app.example.invalid/health" });
    expect(js.jobs.check_smoke_script["continue-on-error"]).toBe(true);
    expect(js.permissions).toEqual({ contents: "read" });
    expect(out.skipped.map((s) => s.key).sort()).toEqual(["errors", "off", "runbook"]);
    expect(out.yaml).toContain("if: inputs.stage == 'verify' || inputs.stage == 'all'");
    expect(out.yaml).not.toMatch(/inputs\.stage == "/);
  });
  it("keeps spec values out of shell text, so validated values cannot inject commands", () => {
    const weird = c({ name: 'Probe "quoted" $(id)', spec: { url: "https://app.example.invalid/h?q=$(id)&x=`id`", expectStatus: 200, maxLatencyMs: 500 } });
    expect(validateCheck({ key: weird.key, name: weird.name, kind: weird.kind, stage: weird.stage, mode: weird.mode, spec: weird.spec }).ok).toBe(true);
    const out = generateCheckWorkflow([weird]);
    const js = parseDocument(out.yaml).toJS() as { jobs: Record<string, { name: string; env: Record<string, string>; steps: Array<{ run?: string }> }> };
    expect(js.jobs.check_health_probe.env.CHECK_URL).toBe("https://app.example.invalid/h?q=$(id)&x=`id`");
    expect(js.jobs.check_health_probe.steps.map((s) => s.run ?? "").join("\n")).not.toContain("$(id)");
  });
  it("refuses CI expressions in any check text", () => {
    expect(validateCheck({ key: "x", name: "Leak ${{ secrets.TOKEN }}", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://a.example.invalid/", expectStatus: 200, maxLatencyMs: 5 } }).ok).toBe(false);
    expect(validateCheck({ key: "x", name: "ok", kind: "manual_checklist", stage: "verify", mode: "blocking", spec: { items: ["fine", "${{ github.token }}"] } }).ok).toBe(false);
  });
});
