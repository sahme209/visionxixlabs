/**
 * Vitest unit tests for the pure simulator sandbox-spec builder.
 */

import { describe, it, expect } from "vitest";
import { buildSandboxSpec } from "../simulatorSandboxSpec";

const I = (hypothesisKind: string, ids: readonly string[] = ["r-1"]) => ({
  hypothesisId: "h-1",
  hypothesisKind,
  proposedChange: "tighten S3 PAB",
  targetResourceIds: ids,
});

describe("simulatorSandboxSpec", () => {
  it("drift → localstack backend with policy + boundary assertions", () => {
    const s = buildSandboxSpec(I("drift_remediation_needed"));
    expect(s.backend).toBe("localstack");
    const kinds = s.assertions.map((a) => a.kind);
    expect(kinds).toContain("policy_pass");
    expect(kinds).toContain("boundary_pass");
  });

  it("slo_burn → k8s_namespace + metric_in_range", () => {
    const s = buildSandboxSpec(I("slo_burn_active"));
    expect(s.backend).toBe("k8s_namespace");
    expect(s.assertions.some((a) => a.kind === "metric_in_range")).toBe(true);
  });

  it("exploit window → ephemeral_vm + 15-min timeout", () => {
    const s = buildSandboxSpec(I("exploit_window_open"));
    expect(s.backend).toBe("ephemeral_vm");
    expect(s.timeoutSec).toBe(900);
  });

  it("unknown kind → in_memory_mock fallback", () => {
    const s = buildSandboxSpec(I("not_a_real_kind"));
    expect(s.backend).toBe("in_memory_mock");
  });

  it("every spec includes 'no_destructive_calls' assertion first", () => {
    const s = buildSandboxSpec(I("slo_burn_active"));
    expect(s.assertions[0].kind).toBe("no_destructive_calls");
  });

  it("cloneResources sorted alphabetically", () => {
    const s = buildSandboxSpec(I("drift_remediation_needed", ["zz", "aa", "mm"]));
    expect(s.cloneResources).toEqual(["aa", "mm", "zz"]);
  });

  it("needsLiveCreds only for drift + exploit", () => {
    expect(buildSandboxSpec(I("drift_remediation_needed")).needsLiveCreds).toBe(true);
    expect(buildSandboxSpec(I("exploit_window_open")).needsLiveCreds).toBe(true);
    expect(buildSandboxSpec(I("slo_burn_active")).needsLiveCreds).toBe(false);
  });

  it("proposedChange clipped at 1000 chars", () => {
    const long = "x".repeat(2000);
    const s = buildSandboxSpec({ ...I("drift_remediation_needed"), proposedChange: long });
    expect(s.proposedChange.length).toBe(1000);
  });
});
