import { describe, expect, it } from "vitest";
import {
  buildAlertNotification,
  channelsForSeverity,
  severityForEvent,
  type NotificationInput,
} from "../alertNotificationBuilder";

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — pin severity + channel routing for every event.
   ────────────────────────────────────────────────────────────── */

describe("severityForEvent — closed-union severity mapping", () => {
  const cases: Array<[string, "critical" | "high" | "info" | "low" | null]> = [
    ["signal_fired",          "high"],
    ["escalation_triggered",  "critical"],
    ["alert_expired",         "critical"],
    ["operator_acknowledged", "info"],
    ["operator_resolved",     "info"],
    ["signal_cleared",        "low"],
    ["operator_snoozed",      "low"],
    ["snooze_expired",        "high"],
    ["mystery_event",         null],
  ];
  it.each(cases)("%s → %s", (eventKind, expected) => {
    expect(severityForEvent(eventKind)).toBe(expected);
  });
});

describe("channelsForSeverity — strict ladder", () => {
  it("critical → oncall_pager + team_chat + audit_log", () => {
    expect(channelsForSeverity("critical")).toEqual(["oncall_pager", "team_chat", "audit_log"]);
  });

  it("high → team_chat + audit_log (no pager)", () => {
    expect(channelsForSeverity("high")).toEqual(["team_chat", "audit_log"]);
  });

  it("info → audit_log only", () => {
    expect(channelsForSeverity("info")).toEqual(["audit_log"]);
  });

  it("low → audit_log only", () => {
    expect(channelsForSeverity("low")).toEqual(["audit_log"]);
  });

  it("only critical pages the on-call rotation", () => {
    for (const sev of ["high", "info", "low"] as const) {
      expect(channelsForSeverity(sev)).not.toContain("oncall_pager");
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   Builder.
   ────────────────────────────────────────────────────────────── */

function makeInput(over: Partial<NotificationInput["transition"]> = {}): NotificationInput {
  return {
    signalRef: "connector_setup:aws:org_42",
    transition: {
      id: "tx_1",
      sessionId: "sess_1",
      fromStatus: "quiet",
      toStatus: "fired",
      eventKind: "signal_fired",
      isLegal: true,
      actorUserId: null,
      actorLabel: "bridge:sticky-error",
      ...over,
    },
  };
}

describe("buildAlertNotification — legal transitions produce a notification", () => {
  it("signal_fired (sticky-error bridge) → high severity, team_chat + audit_log", () => {
    const n = buildAlertNotification(makeInput());
    expect(n).not.toBeNull();
    if (!n) return;
    expect(n.severity).toBe("high");
    expect(n.channels).toEqual(["team_chat", "audit_log"]);
    expect(n.subject).toContain("connector_setup:aws:org_42");
    expect(n.subject).toContain("alert fired");
    expect(n.body).toContain("Sticky-error bridge");
    expect(n.body).toContain("[HIGH]");
    expect(n.idempotencyKey).toBe("alert-notification:sess_1:tx_1:signal_fired");
  });

  it("escalation_triggered → critical severity, oncall_pager included", () => {
    const n = buildAlertNotification(makeInput({
      eventKind: "escalation_triggered",
      fromStatus: "fired", toStatus: "escalated",
      actorLabel: "escalation-policy:default", actorUserId: null,
    }));
    expect(n).not.toBeNull();
    if (!n) return;
    expect(n.severity).toBe("critical");
    expect(n.channels).toContain("oncall_pager");
    expect(n.body).toContain("Escalation policy");
    expect(n.body).toContain("escalated to on-call");
  });

  it("alert_expired → critical (no one ack'd!)", () => {
    const n = buildAlertNotification(makeInput({
      eventKind: "alert_expired", fromStatus: "escalated", toStatus: "expired",
    }));
    expect(n?.severity).toBe("critical");
    expect(n?.channels).toContain("oncall_pager");
  });

  it("operator_acknowledged → info severity, audit_log only", () => {
    const n = buildAlertNotification(makeInput({
      eventKind: "operator_acknowledged", fromStatus: "fired", toStatus: "acknowledged",
      actorUserId: "user_42", actorLabel: null,
    }));
    expect(n?.severity).toBe("info");
    expect(n?.channels).toEqual(["audit_log"]);
    expect(n?.body).toContain("Operator");
  });

  it("signal_cleared (auto-resolved) → low severity, audit_log only", () => {
    const n = buildAlertNotification(makeInput({
      eventKind: "signal_cleared", fromStatus: "fired", toStatus: "auto_resolved",
    }));
    expect(n?.severity).toBe("low");
    expect(n?.body).toContain("signal cleared on its own");
  });

  it("snooze_expired → high severity (alert re-firing)", () => {
    const n = buildAlertNotification(makeInput({
      eventKind: "snooze_expired", fromStatus: "snoozed", toStatus: "fired",
      actorLabel: "snooze-timer", actorUserId: null,
    }));
    expect(n?.severity).toBe("high");
    expect(n?.body).toContain("Snooze timer");
    expect(n?.body).toContain("alert re-fired after snooze");
  });
});

describe("buildAlertNotification — illegal transitions never page", () => {
  it("isLegal:false returns null (no notification)", () => {
    expect(buildAlertNotification(makeInput({ isLegal: false }))).toBeNull();
  });

  it("unknown eventKind returns null (conservative)", () => {
    expect(buildAlertNotification(makeInput({ eventKind: "mystery_event" }))).toBeNull();
  });
});

describe("buildAlertNotification — idempotency", () => {
  it("same transition produces the same key (stable across retries)", () => {
    const n1 = buildAlertNotification(makeInput());
    const n2 = buildAlertNotification(makeInput());
    expect(n1?.idempotencyKey).toBe(n2?.idempotencyKey);
  });

  it("different transitions on the same session produce different keys", () => {
    const a = buildAlertNotification(makeInput());
    const b = buildAlertNotification(makeInput({ id: "tx_2", eventKind: "escalation_triggered", toStatus: "escalated" }));
    expect(a?.idempotencyKey).not.toBe(b?.idempotencyKey);
  });

  it("same transition id but different sessions → different keys (org isolation)", () => {
    const a = buildAlertNotification(makeInput());
    const b = buildAlertNotification(makeInput({ sessionId: "sess_other" }));
    expect(a?.idempotencyKey).not.toBe(b?.idempotencyKey);
  });
});

describe("buildAlertNotification — no SDK / env leakage", () => {
  it("subject + body never reference internal jargon", () => {
    const events = [
      "signal_fired", "escalation_triggered", "operator_acknowledged",
      "operator_snoozed", "snooze_expired", "operator_resolved",
      "signal_cleared", "alert_expired",
    ];
    for (const eventKind of events) {
      const n = buildAlertNotification(makeInput({ eventKind, toStatus: "fired" }));
      if (!n) continue;
      const blob = `${n.subject} ${n.body}`;
      expect(blob).not.toMatch(/process\.env|AWS_SDK|prisma|node_modules/i);
    }
  });
});
