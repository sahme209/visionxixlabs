import { describe, expect, it } from "vitest";
import { decideAlertEventFromStickyClassification } from "../alertEscalationBridge";
import {
  ALL_ALERT_STATUSES,
  transitionAlertEscalation,
  type AlertEscalationStatus,
} from "../alertEscalationSession";
import type { StickyErrorClassification } from "@/lib/connectors/connectorSetupStickyError";

/* ──────────────────────────────────────────────────────────────────
   Phase 426 — bridge tests.

   Same property-test pattern Phase 416 uses against the connector
   kernel: every emit must be a legal transition. That guarantees the
   bridge can NEVER produce audit-log noise.
   ────────────────────────────────────────────────────────────── */

const NOW = new Date("2026-05-25T12:00:00Z");

const HEALTHY: StickyErrorClassification = { kind: "healthy", reason: "no_history" };
const TRANSIENT: StickyErrorClassification = { kind: "transient_failure", lastFailureAt: NOW, errorCode: "AccessDenied" };
const STICKY: StickyErrorClassification = { kind: "sticky_error", errorCode: "AccessDenied", consecutiveCount: 3, firstSeenAt: NOW, lastSeenAt: NOW };
const OSCILLATING: StickyErrorClassification = { kind: "chronic_oscillation", regressCount: 3, recoverCount: 3, windowFirstAt: NOW, windowLastAt: NOW };

const ALL_CLASSIFICATIONS: ReadonlyArray<StickyErrorClassification> = [HEALTHY, TRANSIENT, STICKY, OSCILLATING];

describe("decideAlertEventFromStickyClassification — every emit is a legal kernel transition", () => {
  it("never returns an emit the kernel would reject", () => {
    for (const status of ALL_ALERT_STATUSES) {
      for (const cls of ALL_CLASSIFICATIONS) {
        const decision = decideAlertEventFromStickyClassification(cls, status, { signalRef: "sig:test" });
        if (decision.kind === "noop") continue;
        const result = transitionAlertEscalation(status, decision.event);
        expect(
          result.ok,
          `bridge emitted ${decision.event.kind} from ${status} for ${cls.kind}, but kernel rejected`,
        ).toBe(true);
      }
    }
  });
});

describe("decideAlertEventFromStickyClassification — sticky/oscillation escalate from closed statuses", () => {
  it("sticky_error + quiet → signal_fired", () => {
    const d = decideAlertEventFromStickyClassification(STICKY, "quiet", { signalRef: "sig:aws:org_42" });
    expect(d).toEqual({ kind: "emit", event: { kind: "signal_fired", signalRef: "sig:aws:org_42" } });
  });

  it("chronic_oscillation + quiet → signal_fired", () => {
    const d = decideAlertEventFromStickyClassification(OSCILLATING, "quiet", { signalRef: "sig:x" });
    expect(d.kind).toBe("emit");
    if (d.kind === "emit") expect(d.event.kind).toBe("signal_fired");
  });

  it("sticky_error after auto_resolved → re-fires (signal flared again)", () => {
    const d = decideAlertEventFromStickyClassification(STICKY, "auto_resolved", { signalRef: "sig:x" });
    expect(d.kind).toBe("emit");
  });

  it("sticky_error after resolved → re-fires (operator marked done but it came back)", () => {
    const d = decideAlertEventFromStickyClassification(STICKY, "resolved", { signalRef: "sig:x" });
    expect(d.kind).toBe("emit");
  });

  it("sticky_error after expired → re-fires (got missed, fire again)", () => {
    const d = decideAlertEventFromStickyClassification(STICKY, "expired", { signalRef: "sig:x" });
    expect(d.kind).toBe("emit");
  });
});

describe("decideAlertEventFromStickyClassification — open alert suppresses re-fire", () => {
  it("sticky_error while alert is fired/escalated/acknowledged/snoozed → noop already_open", () => {
    for (const status of ["fired", "escalated", "acknowledged", "snoozed"] as const) {
      const d = decideAlertEventFromStickyClassification(STICKY, status, { signalRef: "sig:x" });
      expect(d).toEqual({ kind: "noop", reason: "already_open" });
    }
  });
});

describe("decideAlertEventFromStickyClassification — healthy clears open alerts", () => {
  it("healthy + open status → signal_cleared event", () => {
    for (const status of ["fired", "escalated", "acknowledged", "snoozed"] as const) {
      const d = decideAlertEventFromStickyClassification(HEALTHY, status, { signalRef: "sig:x" });
      expect(d).toEqual({ kind: "emit", event: { kind: "signal_cleared" } });
    }
  });

  it("healthy + already-closed status → noop no_signal_to_clear", () => {
    for (const status of ["quiet", "resolved", "auto_resolved", "expired"] as const) {
      const d = decideAlertEventFromStickyClassification(HEALTHY, status, { signalRef: "sig:x" });
      expect(d).toEqual({ kind: "noop", reason: "no_signal_to_clear" });
    }
  });
});

describe("decideAlertEventFromStickyClassification — transient never escalates", () => {
  it("transient_failure + any status → noop classification_is_transient", () => {
    for (const status of ALL_ALERT_STATUSES) {
      const d = decideAlertEventFromStickyClassification(TRANSIENT, status, { signalRef: "sig:x" });
      expect(d).toEqual({ kind: "noop", reason: "classification_is_transient" });
    }
  });
});

describe("decideAlertEventFromStickyClassification — signalRef propagates to emitted event", () => {
  it("signal_fired carries the supplied signalRef verbatim", () => {
    const d = decideAlertEventFromStickyClassification(STICKY, "quiet", { signalRef: "sig:azure:org_99:DEEPCODE" });
    expect(d.kind).toBe("emit");
    if (d.kind === "emit" && d.event.kind === "signal_fired") {
      expect(d.event.signalRef).toBe("sig:azure:org_99:DEEPCODE");
    } else {
      throw new Error("expected signal_fired");
    }
  });
});
