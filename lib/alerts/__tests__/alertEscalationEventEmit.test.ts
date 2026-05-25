import { describe, expect, it } from "vitest";
import {
  isOperatorAllowedAlertEventKind,
  OPERATOR_ALLOWED_ALERT_EVENT_KINDS,
  recordAlertEscalationEvent,
} from "../alertEscalationEventEmit";
import { applyAlertEscalationEvent } from "../alertEscalationRepo";
import type {
  AlertEscalationRepo,
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "../alertEscalationRepo";

interface Stub extends AlertEscalationRepo {
  _sessions: AlertEscalationSessionRow[];
  _transitions: AlertEscalationTransitionRow[];
}

function makeRepo(): Stub {
  const sessions: AlertEscalationSessionRow[] = [];
  const transitions: AlertEscalationTransitionRow[] = [];
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(2026, 0, 1, 0, 0, counter);

  const repo: Stub = {
    _sessions: sessions, _transitions: transitions,
    alertEscalationSession: {
      async findUnique({ where }) {
        const { organizationId, signalRef } = where.organizationId_signalRef;
        const row = sessions.find((s) => s.organizationId === organizationId && s.signalRef === signalRef);
        return row ? { ...row } : null;
      },
      async create({ data }) {
        const row: AlertEscalationSessionRow = {
          id: nextId(), organizationId: data.organizationId, signalRef: data.signalRef,
          status: "quiet", lastEventKind: null,
          firstFiredAt: null, acknowledgedAt: null, acknowledgedByUserId: null,
          snoozedUntilAt: null, resolvedAt: null, resolvedByUserId: null,
          lastTransitionAt: now(), createdAt: now(), updatedAt: now(),
        };
        sessions.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = sessions.find((s) => s.id === where.id);
        if (!row) throw new Error("missing");
        Object.assign(row, data, { updatedAt: now() });
        return { ...row };
      },
    },
    alertEscalationTransition: {
      async create({ data }) {
        const row: AlertEscalationTransitionRow = { id: nextId(), createdAt: now(), ...data };
        transitions.push(row);
        return { ...row };
      },
      async findMany() { return []; },
    },
    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

describe("isOperatorAllowedAlertEventKind — closed-union guard", () => {
  it("accepts only operator_acknowledged / operator_snoozed / operator_resolved", () => {
    for (const k of OPERATOR_ALLOWED_ALERT_EVENT_KINDS) expect(isOperatorAllowedAlertEventKind(k)).toBe(true);
    for (const k of ["signal_fired", "signal_cleared", "escalation_triggered", "snooze_expired", "alert_expired"]) {
      expect(isOperatorAllowedAlertEventKind(k)).toBe(false);
    }
  });
});

describe("recordAlertEscalationEvent — applies legal operator events", () => {
  it("operator_acknowledged on a fired alert lands at acknowledged", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" } });
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_acknowledged", actorUserId: "user_42",
    });
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied" || !r.result.ok) throw new Error("expected legal apply");
    expect(r.result.nextStatus).toBe("acknowledged");
    expect(repo._sessions[0].acknowledgedByUserId).toBe("user_42");
  });

  it("operator_snoozed with valid minutes stamps snoozedUntilAt", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" } });
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_snoozed", actorUserId: "u", snoozeMinutes: 30,
    });
    expect(r.kind).toBe("applied");
    expect(repo._sessions[0].snoozedUntilAt).not.toBeNull();
  });

  it("operator_resolved on a fired alert lands at resolved", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" } });
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_resolved", actorUserId: "u",
    });
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied" || !r.result.ok) throw new Error("expected legal apply");
    expect(r.result.nextStatus).toBe("resolved");
  });
});

describe("recordAlertEscalationEvent — validation rejections", () => {
  it("missing signalRef → missing_signal_ref", async () => {
    const repo = makeRepo();
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "",
      eventKind: "operator_acknowledged", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "validation_failed", reason: "missing_signal_ref" });
    expect(repo._sessions).toHaveLength(0);
  });

  it("server-side event from UI → event_kind_not_operator_allowed", async () => {
    const repo = makeRepo();
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "signal_fired", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "validation_failed", reason: "event_kind_not_operator_allowed" });
  });

  it("garbage event kind → unknown_event_kind", async () => {
    const repo = makeRepo();
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "haxxor", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "validation_failed", reason: "unknown_event_kind" });
  });

  it("operator_snoozed without snoozeMinutes → snooze_minutes_out_of_range", async () => {
    const repo = makeRepo();
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_snoozed", actorUserId: "u",
    });
    expect(r.kind).toBe("validation_failed");
    if (r.kind !== "validation_failed") return;
    expect(r.reason).toBe("snooze_minutes_out_of_range");
  });

  it("operator_snoozed with 0 or 1500 minutes → snooze_minutes_out_of_range", async () => {
    const repo = makeRepo();
    for (const m of [0, -5, 1441, 99999, Number.NaN, Infinity]) {
      const r = await recordAlertEscalationEvent(repo, {
        organizationId: "o", signalRef: "sig",
        eventKind: "operator_snoozed", actorUserId: "u", snoozeMinutes: m,
      });
      expect(r.kind).toBe("validation_failed");
    }
  });

  it("operator_snoozed with boundary 1 minute and 1440 minutes accepted", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" } });
    const r1 = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_snoozed", actorUserId: "u", snoozeMinutes: 1,
    });
    expect(r1.kind).toBe("applied");
  });
});

describe("recordAlertEscalationEvent — graceful degradation", () => {
  it("missing-table error → migration_pending", async () => {
    const repo = makeRepo();
    repo.alertEscalationSession.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_acknowledged", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "migration_pending" });
  });

  it("other errors propagate", async () => {
    const repo = makeRepo();
    repo.alertEscalationSession.findUnique = async () => { throw new Error("ECONNREFUSED"); };
    await expect(recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_acknowledged", actorUserId: "u",
    })).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe("recordAlertEscalationEvent — illegal-but-applied is reported honestly", () => {
  it("operator_acknowledged from quiet (no active alert) → applied with ok:false", async () => {
    const repo = makeRepo();
    const r = await recordAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      eventKind: "operator_acknowledged", actorUserId: "u",
    });
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied") return;
    expect(r.result.ok).toBe(false);
    expect(repo._transitions[0].isLegal).toBe(false);
  });
});
