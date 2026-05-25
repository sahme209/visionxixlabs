import { describe, expect, it } from "vitest";
import {
  describeAlertTransition,
  suggestAlertAction,
  type AlertTransitionView,
} from "../alertEscalationOperatorCopy";
import { ALL_ALERT_STATUSES, alertStatusLabel } from "../alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   suggestAlertAction.
   ────────────────────────────────────────────────────────────── */

describe("suggestAlertAction — every status produces stable copy", () => {
  it.each(ALL_ALERT_STATUSES)("%s produces a non-empty description", (s) => {
    const a = suggestAlertAction(s);
    expect(a.description.length).toBeGreaterThan(15);
    if (a.tone === "none") {
      expect(a.ctaLabel).toBe("");
    } else {
      expect(a.ctaLabel.length).toBeGreaterThan(0);
    }
  });

  it("primary on fired / acknowledged, danger on escalated, none on closed", () => {
    expect(suggestAlertAction("fired").tone).toBe("primary");
    expect(suggestAlertAction("escalated").tone).toBe("danger");
    expect(suggestAlertAction("acknowledged").tone).toBe("primary");
    expect(suggestAlertAction("snoozed").tone).toBe("secondary");
    expect(suggestAlertAction("quiet").tone).toBe("none");
    expect(suggestAlertAction("resolved").tone).toBe("none");
    expect(suggestAlertAction("auto_resolved").tone).toBe("none");
    expect(suggestAlertAction("expired").tone).toBe("none");
  });

  it("snoozed renders the remaining countdown as a hint", () => {
    const a = suggestAlertAction("snoozed", 12);
    expect(a.hint).toMatch(/12 minutes/);
  });

  it("snoozed with zero/negative remaining renders the elapsed hint", () => {
    expect(suggestAlertAction("snoozed", 0).hint).toMatch(/elapsed/);
    expect(suggestAlertAction("snoozed", -3).hint).toMatch(/elapsed/);
    expect(suggestAlertAction("snoozed", null).hint).toMatch(/elapsed/);
    expect(suggestAlertAction("snoozed").hint).toMatch(/elapsed/);
  });

  it("snoozed remaining=1 uses singular minute (no `minutes` plural)", () => {
    expect(suggestAlertAction("snoozed", 1).hint).toMatch(/1 minute(?!s)/);
  });

  it("never leaks SDK / internal jargon", () => {
    for (const s of ALL_ALERT_STATUSES) {
      const a = suggestAlertAction(s);
      const blob = `${a.ctaLabel} ${a.description} ${a.hint ?? ""}`;
      expect(blob).not.toMatch(/process\.env|kernel_|axiom_internal/i);
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   describeAlertTransition.
   ────────────────────────────────────────────────────────────── */

const baseTx = { isLegal: true as const, actorUserId: "user_1", actorLabel: null };

describe("describeAlertTransition — legal transitions render verb + new status", () => {
  it("signal_fired → contains 'fired the alert' and new label", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "signal_fired",
      fromStatus: "quiet", toStatus: "fired",
    };
    const line = describeAlertTransition(t);
    expect(line).toMatch(/fired the alert/i);
    expect(line.toLowerCase()).toContain(alertStatusLabel("fired").toLowerCase());
  });

  it("escalation_triggered → 'escalated to on-call'", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "escalation_triggered",
      fromStatus: "fired", toStatus: "escalated",
    };
    expect(describeAlertTransition(t)).toMatch(/escalated to on-call/i);
  });

  it("operator_acknowledged → 'acknowledged'", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "operator_acknowledged",
      fromStatus: "fired", toStatus: "acknowledged",
    };
    expect(describeAlertTransition(t)).toMatch(/acknowledged/i);
  });

  it("operator_snoozed → 'snoozed the alert'", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "operator_snoozed",
      fromStatus: "fired", toStatus: "snoozed",
    };
    expect(describeAlertTransition(t)).toMatch(/snoozed the alert/i);
  });

  it("snooze_expired → 'ended the snooze'", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "snooze_expired",
      fromStatus: "snoozed", toStatus: "fired",
    };
    expect(describeAlertTransition(t)).toMatch(/ended the snooze/i);
  });

  it("signal_cleared → 'saw the signal clear'", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "signal_cleared",
      fromStatus: "fired", toStatus: "auto_resolved",
    };
    expect(describeAlertTransition(t)).toMatch(/saw the signal clear/i);
  });

  it("alert_expired → 'expired without acknowledgement'", () => {
    const t: AlertTransitionView = {
      ...baseTx, eventKind: "alert_expired",
      fromStatus: "escalated", toStatus: "expired",
    };
    expect(describeAlertTransition(t)).toMatch(/expired without acknowledgement/i);
  });
});

describe("describeAlertTransition — actor labels", () => {
  it("operator (userId) → 'Operator …'", () => {
    const t: AlertTransitionView = { ...baseTx, eventKind: "operator_acknowledged", fromStatus: "fired", toStatus: "acknowledged" };
    expect(describeAlertTransition(t)).toMatch(/^Operator/);
  });

  it("actorLabel='bridge:sticky-error' → 'Sticky-error bridge …'", () => {
    const t: AlertTransitionView = {
      isLegal: true, actorUserId: null, actorLabel: "bridge:sticky-error",
      eventKind: "signal_fired", fromStatus: "quiet", toStatus: "fired",
    };
    expect(describeAlertTransition(t)).toMatch(/^Sticky-error bridge/);
  });

  it("actorLabel='escalation-policy:default' → 'Escalation policy …'", () => {
    const t: AlertTransitionView = {
      isLegal: true, actorUserId: null, actorLabel: "escalation-policy:default",
      eventKind: "escalation_triggered", fromStatus: "fired", toStatus: "escalated",
    };
    expect(describeAlertTransition(t)).toMatch(/^Escalation policy/);
  });

  it("actorLabel='snooze-timer' → 'Snooze timer …'", () => {
    const t: AlertTransitionView = {
      isLegal: true, actorUserId: null, actorLabel: "snooze-timer",
      eventKind: "snooze_expired", fromStatus: "snoozed", toStatus: "fired",
    };
    expect(describeAlertTransition(t)).toMatch(/^Snooze timer/);
  });

  it("no actor → 'System …' fallback", () => {
    const t: AlertTransitionView = {
      isLegal: true, actorUserId: null, actorLabel: null,
      eventKind: "signal_cleared", fromStatus: "fired", toStatus: "auto_resolved",
    };
    expect(describeAlertTransition(t)).toMatch(/^System/);
  });
});

describe("describeAlertTransition — illegal transitions render 'Ignored'", () => {
  it("renders illegal attempts with the from-status label", () => {
    const t: AlertTransitionView = {
      isLegal: false, actorUserId: "u", actorLabel: null,
      eventKind: "signal_fired", fromStatus: "fired", toStatus: "fired",
    };
    const line = describeAlertTransition(t);
    expect(line).toMatch(/Ignored/);
    expect(line.toLowerCase()).toContain("firing");
  });
});
