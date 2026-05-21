import { describe, it, expect } from "vitest";
import {
  DESKTOP_SCRIPTS,
  getDesktopScript,
  resolveScriptForRuntime,
  summarizeDesktopScripts,
} from "../desktopScriptCatalog";

describe("desktopScriptCatalog", () => {
  it("every script has a unique id", () => {
    const ids = new Set(DESKTOP_SCRIPTS.map((s) => s.id));
    expect(ids.size).toBe(DESKTOP_SCRIPTS.length);
  });

  it("getDesktopScript returns the row", () => {
    expect(getDesktopScript("repo_audit_v1")?.name).toMatch(/Git repo audit/);
    expect(getDesktopScript("does_not_exist")).toBeUndefined();
  });

  it("resolveScriptForRuntime — unknown script", () => {
    const r = resolveScriptForRuntime("does_not_exist", "macos", []);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown_script");
  });

  it("resolveScriptForRuntime — unsupported OS", () => {
    // env_diagnostic_v1 only supports macos + linux.
    const r = resolveScriptForRuntime("env_diagnostic_v1", "windows", ["filesystem_read"]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("os_unsupported");
  });

  it("resolveScriptForRuntime — missing capability", () => {
    const r = resolveScriptForRuntime("docker_health_v1", "macos", []);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_capability");
    expect(r.missing).toBe("docker");
  });

  it("resolveScriptForRuntime — all capabilities present", () => {
    const r = resolveScriptForRuntime("kubectl_context_check_v1", "linux", ["kubectl"]);
    expect(r.ok).toBe(true);
  });

  it("summarizeDesktopScripts shape", () => {
    const s = summarizeDesktopScripts();
    expect(s.total).toBe(DESKTOP_SCRIPTS.length);
    expect(s.byOs.macos + s.byOs.windows + s.byOs.linux).toBeGreaterThanOrEqual(s.total);
    expect(s.byRiskTier.low + s.byRiskTier.medium + s.byRiskTier.high + s.byRiskTier.critical).toBe(s.total);
  });

  it("every script supports at least one OS", () => {
    for (const s of DESKTOP_SCRIPTS) {
      expect(s.supportsOs.length).toBeGreaterThan(0);
    }
  });

  it("high-risk scripts must support dry run OR explicitly opt out (ml is the documented exception)", () => {
    for (const s of DESKTOP_SCRIPTS) {
      if (s.riskTier === "high" && !s.supportsDryRun) {
        // Only known exception today: local_model_inference_v1 (inference is read-only).
        expect(s.id).toBe("local_model_inference_v1");
      }
    }
  });

  it("each script timeout is bounded", () => {
    for (const s of DESKTOP_SCRIPTS) {
      expect(s.timeoutSeconds).toBeGreaterThan(0);
      expect(s.timeoutSeconds).toBeLessThanOrEqual(600);
    }
  });
});
