import { describe, expect, it } from "vitest";
import { CAPABILITY_PROFILES, ENGINE_KINDS, NORMALIZED_STATES, cancelResult, normalizeState, reconcileObservations, requireCapability } from "../contract";

const at = new Date("2026-11-09T00:00:00Z");

describe("orchestrator contract foundations (A9.5)", () => {
  it("has a reviewed read-only profile for every engine, none of which can submit or cancel", () => {
    for (const e of ENGINE_KINDS) {
      const p = CAPABILITY_PROFILES[e];
      expect(p.schemaVersion).toBe("axiom.orchestrator/1");
      expect(p.capabilities.start).toBe("unsupported");
      expect(p.capabilities.cancel).toBe("unsupported");
      expect(p.capabilities.status).toBe("supported");
      expect(p.limits.join(" ")).toMatch(/never implies Governance coverage/);
    }
  });

  it("C01: refuses unknown schema, unknown engine and unsupported operations before any I/O", () => {
    expect(requireCapability({ schemaVersion: "axiom.orchestrator/2", engineKind: "airflow", operation: "status" })).toMatchObject({ ok: false, error: "unsupported" });
    expect(requireCapability({ schemaVersion: "axiom.orchestrator/1", engineKind: "temporal", operation: "status" })).toMatchObject({ ok: false, error: "unsupported" });
    expect(requireCapability({ schemaVersion: "axiom.orchestrator/1", engineKind: "prefect", operation: "start" })).toMatchObject({ ok: false, error: "unsupported", detail: expect.stringMatching(/start is not supported/) });
    expect(requireCapability({ schemaVersion: "axiom.orchestrator/1", engineKind: "dagster", operation: "status" }).ok).toBe(true);
  });

  it("C09: cancellation is reported as not supported, never simulated", () => {
    for (const e of ENGINE_KINDS) expect(cancelResult(e)).toBe("notSupported");
  });

  it("normalizes native states and keeps unknown states unknown (never a guessed terminal)", () => {
    expect(normalizeState("airflow", "success", at)).toMatchObject({ state: "succeeded", nativeState: "success" });
    expect(normalizeState("prefect", "CRASHED", at).state).toBe("failed");
    expect(normalizeState("dagster", "CANCELING", at).state).toBe("cancelRequested");
    expect(normalizeState("argo_workflows", "Error", at).state).toBe("failed");
    for (const e of ENGINE_KINDS) { expect(normalizeState(e, "deferred-mystery", at).state).toBe("unknown"); expect(normalizeState(e, null, at).state).toBe("unknown"); }
    for (const e of ENGINE_KINDS) expect(NORMALIZED_STATES).toContain(normalizeState(e, "x", at).state);
  });

  it("records an anomaly instead of regressing a terminal state", () => {
    const done = normalizeState("prefect", "COMPLETED", at);
    expect(reconcileObservations(done, normalizeState("prefect", "RUNNING", at))).toEqual({ state: "succeeded", anomaly: true });
    expect(reconcileObservations(normalizeState("prefect", "RUNNING", at), done)).toEqual({ state: "succeeded", anomaly: false });
    expect(reconcileObservations(null, done)).toEqual({ state: "succeeded", anomaly: false });
  });
});
