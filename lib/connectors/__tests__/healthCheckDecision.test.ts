import { describe, expect, it } from "vitest";
import { decideHealthCheckEvent, type ProbeOutcome } from "../healthCheckDecision";
import {
  ALL_STATUSES,
  transitionConnectorSetup,
  type ConnectorSetupStatus,
} from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 416 — health-check decider matrix.

   Two contracts to pin:
   1. The decider's per-(status, outcome) output is stable and
      documented — a regression here changes audit-log shape.
   2. *Every emitted event* must be a legal transition from the
      given status, so the decider never produces audit noise.
      We assert (1) directly and (2) via cross-checking against
      the kernel.
   ────────────────────────────────────────────────────────────── */

const OUTCOMES: ProbeOutcome[] = ["success", "auth_failed", "revoked", "transient_error"];

describe("decideHealthCheckEvent — every emit is a legal kernel transition", () => {
  it("never returns an emit that the kernel would reject", () => {
    for (const status of ALL_STATUSES) {
      for (const outcome of OUTCOMES) {
        const decision = decideHealthCheckEvent(status, outcome);
        if (decision.kind === "noop") continue;
        const kernelResult = transitionConnectorSetup(status, decision.event);
        expect(
          kernelResult.ok,
          `decider emitted ${decision.event.kind} from ${status} on ${outcome}, but kernel rejected`,
        ).toBe(true);
      }
    }
  });
});

describe("decideHealthCheckEvent — happy-path recovery + regression", () => {
  it("connected + auth_failed → health_check_regressed", () => {
    const d = decideHealthCheckEvent("connected", "auth_failed");
    expect(d).toEqual({ kind: "emit", event: { kind: "health_check_regressed" } });
  });

  it("needs_attention + success → health_check_recovered", () => {
    const d = decideHealthCheckEvent("needs_attention", "success");
    expect(d).toEqual({ kind: "emit", event: { kind: "health_check_recovered" } });
  });

  it("connected + success → noop (already_in_target_state, no audit spam)", () => {
    const d = decideHealthCheckEvent("connected", "success");
    expect(d).toEqual({ kind: "noop", reason: "already_in_target_state" });
  });

  it("needs_attention + auth_failed → validation_failed with HealthCheckAuthFailed errorCode", () => {
    const d = decideHealthCheckEvent("needs_attention", "auth_failed");
    expect(d).toEqual({
      kind: "emit",
      event: { kind: "validation_failed", errorCode: "HealthCheckAuthFailed" },
    });
  });
});

describe("decideHealthCheckEvent — revoked is terminal, only from active states", () => {
  it("connected + revoked → provider_revoked_credentials", () => {
    expect(decideHealthCheckEvent("connected", "revoked")).toEqual({
      kind: "emit", event: { kind: "provider_revoked_credentials" },
    });
  });

  it("needs_attention + revoked → provider_revoked_credentials", () => {
    expect(decideHealthCheckEvent("needs_attention", "revoked")).toEqual({
      kind: "emit", event: { kind: "provider_revoked_credentials" },
    });
  });

  it("failed/disconnected/revoked + revoked → noop (kernel rejects, no point asking)", () => {
    for (const s of ["failed", "disconnected", "revoked"] as const) {
      const d = decideHealthCheckEvent(s, "revoked");
      expect(d).toEqual({ kind: "noop", reason: "no_kernel_event_for_combo" });
    }
  });
});

describe("decideHealthCheckEvent — transient errors are silent", () => {
  it("ANY status + transient_error → noop", () => {
    for (const s of ALL_STATUSES) {
      const d = decideHealthCheckEvent(s, "transient_error");
      // not_connected and in-flight also short-circuit BEFORE the transient
      // check; either reason is acceptable. What matters is no `emit`.
      expect(d.kind).toBe("noop");
    }
  });
});

describe("decideHealthCheckEvent — in-flight + not-yet-started skip cleanly", () => {
  const IN_FLIGHT: ConnectorSetupStatus[] = ["setup_started", "waiting_for_provider", "validating"];

  it("in-flight statuses produce still_in_flight noop regardless of outcome", () => {
    for (const s of IN_FLIGHT) {
      for (const outcome of OUTCOMES) {
        expect(decideHealthCheckEvent(s, outcome)).toEqual({ kind: "noop", reason: "still_in_flight" });
      }
    }
  });

  it("not_connected produces no_session_yet noop regardless of outcome", () => {
    for (const outcome of OUTCOMES) {
      expect(decideHealthCheckEvent("not_connected", outcome)).toEqual({ kind: "noop", reason: "no_session_yet" });
    }
  });
});

describe("decideHealthCheckEvent — recoverable buckets are operator-only", () => {
  const RECOVERABLE: ConnectorSetupStatus[] = ["failed", "disconnected", "revoked"];

  it("recoverable + success/auth_failed → noop (only operator_started lifts them)", () => {
    for (const s of RECOVERABLE) {
      for (const outcome of ["success", "auth_failed"] as const) {
        const d = decideHealthCheckEvent(s, outcome);
        expect(d.kind).toBe("noop");
      }
    }
  });
});
