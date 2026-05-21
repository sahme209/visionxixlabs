import { describe, it, expect } from "vitest";
import {
  planScriptExecution,
  canonicalPlanJson,
  type PlanRequest,
} from "../scriptExecutionPlanner";
import type { PythonScriptManifest } from "../pythonScriptContract";

const MANIFEST: PythonScriptManifest = {
  id: "repo_audit_v1", // matches desktopScriptCatalog
  name: "Repo audit",
  pythonVersion: ">=3.11,<3.13",
  purpose: "Audit a repo.",
  riskTier: "low",
  requiresCapabilities: ["git", "filesystem_read", "python_runtime"],
  pipDependencies: [],
  inputs: [{ name: "path", type: "string", required: true, description: "Repo path", maxLength: 200 }],
  output: { type: "json", description: "Audit." },
  supportsDryRun: true,
  timeoutSeconds: 120,
  allowedExitCodes: [0],
  rollbackNote: null,
};

function req(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    manifest: MANIFEST,
    inputs: { path: "/repo" },
    mode: "cloud",
    dryRun: false,
    approval: { state: "approved", approverEmail: "ops@example.com" },
    ...overrides,
  };
}

describe("planScriptExecution", () => {
  it("approved cloud run with valid inputs → ready", () => {
    const p = planScriptExecution(req());
    expect(p.verdict).toBe("ready");
    expect(p.inputs.path).toBe("/repo");
    expect(p.approved).toBe(true);
    expect(p.approverEmail).toBe("ops@example.com");
  });

  it("pending approval + not dry-run → blocked", () => {
    const p = planScriptExecution(req({ approval: { state: "pending" } }));
    expect(p.verdict).toBe("blocked_missing_approval");
  });

  it("dry-run can proceed without approval", () => {
    const p = planScriptExecution(req({ dryRun: true, approval: { state: "pending" } }));
    expect(p.verdict).toBe("ready");
    expect(p.dryRun).toBe(true);
  });

  it("invalid inputs → blocked_input_invalid", () => {
    const p = planScriptExecution(req({ inputs: { path: 42 } }));
    expect(p.verdict).toBe("blocked_input_invalid");
  });

  it("missing required inputs → blocked_input_invalid", () => {
    const p = planScriptExecution(req({ inputs: {} }));
    expect(p.verdict).toBe("blocked_input_invalid");
  });

  it("high-risk script without supportsDryRun → blocked_dry_run_required", () => {
    const m: PythonScriptManifest = { ...MANIFEST, riskTier: "high", supportsDryRun: false };
    const p = planScriptExecution(req({ manifest: m }));
    expect(p.verdict).toBe("blocked_dry_run_required");
  });

  it("desktop mode without desktopContext → blocked_capability_missing", () => {
    const p = planScriptExecution(req({ mode: "desktop" }));
    expect(p.verdict).toBe("blocked_capability_missing");
  });

  it("desktop mode with missing capability → blocked_capability_missing", () => {
    const p = planScriptExecution(req({
      mode: "desktop",
      desktopContext: { os: "macos", available: ["git"] }, // missing python_runtime + filesystem_read
    }));
    expect(p.verdict).toBe("blocked_capability_missing");
  });

  it("desktop mode with unsupported script id → blocked_script_unknown", () => {
    const fake = { ...MANIFEST, id: "does_not_exist_in_catalog" };
    const p = planScriptExecution(req({
      manifest: fake,
      mode: "desktop",
      desktopContext: { os: "macos", available: ["git", "filesystem_read", "python_runtime"] },
    }));
    expect(p.verdict).toBe("blocked_script_unknown");
  });

  it("desktop mode happy path", () => {
    const p = planScriptExecution(req({
      mode: "desktop",
      desktopContext: { os: "macos", available: ["git", "filesystem_read", "python_runtime"] },
    }));
    expect(p.verdict).toBe("ready");
    expect(p.mode).toBe("desktop");
  });

  it("canonicalPlanJson sorts keys deterministically", () => {
    const p = planScriptExecution(req());
    const j1 = canonicalPlanJson(p);
    const j2 = canonicalPlanJson({ ...p });
    expect(j1).toBe(j2);
    // Verify it's truly sorted at the top level — first key alphabetically.
    const parsed = JSON.parse(j1) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect([...keys].sort()).toEqual(keys);
  });

  it("rationale text differs between dry-run and real run", () => {
    const dry  = planScriptExecution(req({ dryRun: true }));
    const real = planScriptExecution(req());
    expect(dry.rationale).toMatch(/dry-run/i);
    expect(real.rationale).toMatch(/approved/i);
  });
});
