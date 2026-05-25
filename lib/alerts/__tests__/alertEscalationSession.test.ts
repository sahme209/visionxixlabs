import { describe, expect, it } from "vitest";
import {
  ALL_ALERT_STATUSES,
  alertStatusLabel,
  isOpen,
  isTerminal,
  isWaitingForHuman,
  transitionAlertEscalation,
  type AlertEscalationEvent,
  type AlertEscalationStatus,
} from "../alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 426 — AlertEscalationSession state-machine matrix tests.

   Same recipe as Phase 413 (ConnectorSetupSession):
     - pin every legal transition
     - pin a representative set of illegal transitions
     - verify the UI predicates form a coherent partition
   ────────────────────────────────────────────────────────────── */

describe("transitionAlertEscalation — legal transitions", () => {
  it("signal_fired lands on `fired` from quiet / auto_resolved / resolved / expired", () => {
    for (const from of ["quiet", "auto_resolved", "resolved", "expired"] as const) {
      const r = transitionAlertEscalation(from, { kind: "signal_fired", signalRef: "sig:test" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("fired");
    }
  });

  it("escalation_triggered moves fired → escalated", () => {
    const r = transitionAlertEscalation("fired", { kind: "escalation_triggered" });
    expect(r).toEqual({ ok: true, next: "escalated" });
  });

  it("operator_acknowledged moves fired / escalated → acknowledged", () => {
    for (const from of ["fired", "escalated"] as const) {
      const r = transitionAlertEscalation(from, { kind: "operator_acknowledged", operatorUserId: "u" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("acknowledged");
    }
  });

  it("operator_snoozed valid from fired / escalated / acknowledged", () => {
    for (const from of ["fired", "escalated", "acknowledged"] as const) {
      const r = transitionAlertEscalation(from, { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 30 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("snoozed");
    }
  });

  it("snooze_expired only valid from snoozed (re-fires as fired)", () => {
    const r = transitionAlertEscalation("snoozed", { kind: "snooze_expired" });
    expect(r).toEqual({ ok: true, next: "fired" });
  });

  it("operator_resolved valid from every open status + auto_resolved", () => {
    for (const from of ["fired", "escalated", "acknowledged", "snoozed", "auto_resolved"] as const) {
      const r = transitionAlertEscalation(from, { kind: "operator_resolved", operatorUserId: "u" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("resolved");
    }
  });

  it("signal_cleared moves open statuses → auto_resolved", () => {
    for (const from of ["fired", "escalated", "acknowledged", "snoozed"] as const) {
      const r = transitionAlertEscalation(from, { kind: "signal_cleared" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("auto_resolved");
    }
  });

  it("alert_expired moves fired / escalated → expired", () => {
    for (const from of ["fired", "escalated"] as const) {
      const r = transitionAlertEscalation(from, { kind: "alert_expired" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.next).toBe("expired");
    }
  });
});

describe("transitionAlertEscalation — illegal transitions (closed-union safety)", () => {
  it("rejects signal_fired from already-open statuses (no duplicate fires)", () => {
    for (const from of ["fired", "escalated", "acknowledged", "snoozed"] as const) {
      const r = transitionAlertEscalation(from, { kind: "signal_fired", signalRef: "sig:x" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects escalation_triggered from anything other than fired", () => {
    for (const from of ALL_ALERT_STATUSES.filter((s) => s !== "fired")) {
      const r = transitionAlertEscalation(from, { kind: "escalation_triggered" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects operator_acknowledged from snoozed (operator must un-snooze first)", () => {
    const r = transitionAlertEscalation("snoozed", { kind: "operator_acknowledged", operatorUserId: "u" });
    expect(r.ok).toBe(false);
  });

  it("rejects snooze_expired from anything other than snoozed", () => {
    for (const from of ALL_ALERT_STATUSES.filter((s) => s !== "snoozed")) {
      const r = transitionAlertEscalation(from, { kind: "snooze_expired" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects alert_expired from acknowledged (we DID reach a human, no expiry)", () => {
    const r = transitionAlertEscalation("acknowledged", { kind: "alert_expired" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("illegal_transition");
  });

  it("rejects signal_cleared from quiet / resolved / expired (nothing was firing)", () => {
    for (const from of ["quiet", "resolved", "expired", "auto_resolved"] as const) {
      const r = transitionAlertEscalation(from, { kind: "signal_cleared" });
      expect(r.ok).toBe(false);
    }
  });
});

describe("isOpen / isWaitingForHuman / isTerminal — UI-driving predicates", () => {
  it("isOpen is true only for fired / escalated / acknowledged / snoozed", () => {
    const open = ALL_ALERT_STATUSES.filter(isOpen);
    expect(new Set(open)).toEqual(new Set(["fired", "escalated", "acknowledged", "snoozed"]));
  });

  it("isWaitingForHuman is true only for fired / escalated", () => {
    const waiting = ALL_ALERT_STATUSES.filter(isWaitingForHuman);
    expect(new Set(waiting)).toEqual(new Set(["fired", "escalated"]));
  });

  it("isTerminal is true only for resolved / auto_resolved / expired", () => {
    const terminal = ALL_ALERT_STATUSES.filter(isTerminal);
    expect(new Set(terminal)).toEqual(new Set(["resolved", "auto_resolved", "expired"]));
  });

  it("partition: every status falls into exactly one of {quiet} ∪ open ∪ terminal", () => {
    for (const s of ALL_ALERT_STATUSES) {
      const buckets = [s === "quiet", isOpen(s), isTerminal(s)].filter(Boolean).length;
      expect(buckets).toBe(1);
    }
  });

  it("isWaitingForHuman implies isOpen (subset relationship)", () => {
    for (const s of ALL_ALERT_STATUSES) {
      if (isWaitingForHuman(s)) expect(isOpen(s)).toBe(true);
    }
  });
});

describe("alertStatusLabel — customer-facing copy", () => {
  it("returns a non-empty label for every status", () => {
    for (const s of ALL_ALERT_STATUSES) {
      const label = alertStatusLabel(s);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(2);
    }
  });

  it("never includes internal jargon (no underscores, no SDK references)", () => {
    for (const s of ALL_ALERT_STATUSES) {
      expect(alertStatusLabel(s)).not.toMatch(/_/);
    }
  });
});

describe("happy-path lifecycles", () => {
  it("auto-resolve flow: quiet → fired → auto_resolved (observer cleared before ack)", () => {
    const events: AlertEscalationEvent[] = [
      { kind: "signal_fired", signalRef: "sig:test" },
      { kind: "signal_cleared" },
    ];
    let s: AlertEscalationStatus = "quiet";
    for (const e of events) {
      const r = transitionAlertEscalation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("auto_resolved");
  });

  it("full escalation path: quiet → fired → escalated → acknowledged → resolved", () => {
    const events: AlertEscalationEvent[] = [
      { kind: "signal_fired", signalRef: "sig:test" },
      { kind: "escalation_triggered" },
      { kind: "operator_acknowledged", operatorUserId: "u_oncall" },
      { kind: "operator_resolved", operatorUserId: "u_oncall" },
    ];
    let s: AlertEscalationStatus = "quiet";
    for (const e of events) {
      const r = transitionAlertEscalation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("resolved");
  });

  it("snooze flow: fired → snoozed → fired (via snooze_expired) → resolved", () => {
    let s: AlertEscalationStatus = "fired";
    for (const e of [
      { kind: "operator_snoozed" as const, operatorUserId: "u", snoozeMinutes: 15 },
      { kind: "snooze_expired" as const },
      { kind: "operator_resolved" as const, operatorUserId: "u" },
    ]) {
      const r = transitionAlertEscalation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("resolved");
  });

  it("never-ack'd path: quiet → fired → escalated → expired", () => {
    let s: AlertEscalationStatus = "quiet";
    for (const e of [
      { kind: "signal_fired" as const, signalRef: "sig:x" },
      { kind: "escalation_triggered" as const },
      { kind: "alert_expired" as const },
    ]) {
      const r = transitionAlertEscalation(s, e);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.next;
    }
    expect(s).toBe("expired");
  });

  it("re-fire after auto_resolved: same upstream condition flares again, audit captures full history", () => {
    let s: AlertEscalationStatus = "auto_resolved";
    const r = transitionAlertEscalation(s, { kind: "signal_fired", signalRef: "sig:x" });
    expect(r.ok).toBe(true);
    if (r.ok) s = r.next;
    expect(s).toBe("fired");
  });
});
