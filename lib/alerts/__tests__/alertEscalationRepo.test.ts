import { describe, expect, it } from "vitest";
import {
  applyAlertEscalationEvent,
  isKnownAlertStatus,
  listRecentAlertTransitions,
  readAlertEscalationSession,
  type AlertEscalationRepo,
  type AlertEscalationSessionRow,
  type AlertEscalationTransitionRow,
} from "../alertEscalationRepo";
import type { AlertEscalationStatus } from "../alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 427 — in-memory Prisma stub.
   Same shape as the Phase 414 stub, adapted for the alert delegate names.
   ────────────────────────────────────────────────────────────── */

interface Stub extends AlertEscalationRepo {
  _sessions: AlertEscalationSessionRow[];
  _transitions: AlertEscalationTransitionRow[];
  _advance(ms: number): void;
  _now(): Date;
}

function makeRepo(start = new Date("2026-05-25T12:00:00Z")): Stub {
  const sessions: AlertEscalationSessionRow[] = [];
  const transitions: AlertEscalationTransitionRow[] = [];
  let clock = new Date(start);
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;

  const repo: Stub = {
    _sessions: sessions,
    _transitions: transitions,
    _advance(ms) { clock = new Date(clock.getTime() + ms); },
    _now() { return new Date(clock); },

    alertEscalationSession: {
      async findUnique({ where }) {
        const { organizationId, signalRef } = where.organizationId_signalRef;
        const row = sessions.find((s) => s.organizationId === organizationId && s.signalRef === signalRef);
        return row ? { ...row } : null;
      },
      async create({ data }) {
        const row: AlertEscalationSessionRow = {
          id: nextId(),
          organizationId: data.organizationId,
          signalRef: data.signalRef,
          status: "quiet",
          lastEventKind: null,
          firstFiredAt: null,
          acknowledgedAt: null,
          acknowledgedByUserId: null,
          snoozedUntilAt: null,
          resolvedAt: null,
          resolvedByUserId: null,
          lastTransitionAt: new Date(clock),
          createdAt: new Date(clock),
          updatedAt: new Date(clock),
        };
        sessions.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = sessions.find((s) => s.id === where.id);
        if (!row) throw new Error("missing");
        Object.assign(row, data, { updatedAt: new Date(clock) });
        return { ...row };
      },
    },
    alertEscalationTransition: {
      async create({ data }) {
        const row: AlertEscalationTransitionRow = { id: nextId(), createdAt: new Date(clock), ...data };
        transitions.push(row);
        return { ...row };
      },
      async findMany({ where, take }) {
        return transitions
          .filter((t) => t.sessionId === where.sessionId)
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take)
          .map((t) => ({ ...t }));
      },
    },
    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

/* ──────────────────────────────────────────────────────────────────
   Tests.
   ────────────────────────────────────────────────────────────── */

describe("applyAlertEscalationEvent — creates session lazily + persists transition", () => {
  it("signal_fired on a fresh org creates a quiet session then moves it to fired", async () => {
    const repo = makeRepo();
    const r = await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "connector_setup:aws:org_42",
      event: { kind: "signal_fired", signalRef: "connector_setup:aws:org_42" },
      actor: { systemLabel: "bridge:sticky-error" },
      now: repo._now(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.previousStatus).toBe("quiet");
    expect(r.nextStatus).toBe("fired");
    expect(repo._sessions).toHaveLength(1);
    expect(repo._sessions[0].firstFiredAt).not.toBeNull();
    expect(repo._sessions[0].lastEventKind).toBe("signal_fired");
    expect(repo._transitions[0].actorLabel).toBe("bridge:sticky-error");
    expect(repo._transitions[0].eventPayload).toEqual({ signalRef: "connector_setup:aws:org_42" });
  });

  it("idempotent on session creation — second call against same (org, signalRef) reuses row", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig:x",
      event: { kind: "signal_fired", signalRef: "sig:x" },
      actor: { systemLabel: "bridge" },
      now: repo._now(),
    });
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig:x",
      event: { kind: "escalation_triggered" },
      actor: { systemLabel: "escalation-cron" },
      now: repo._now(),
    });
    expect(repo._sessions).toHaveLength(1);
    expect(repo._sessions[0].status).toBe("escalated");
    expect(repo._transitions).toHaveLength(2);
  });
});

describe("applyAlertEscalationEvent — operator interactions stamp additive timestamps", () => {
  it("operator_acknowledged sets acknowledgedAt + acknowledgedByUserId", async () => {
    const repo = makeRepo();
    repo._advance(0);
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig:x",
      event: { kind: "signal_fired", signalRef: "sig:x" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    repo._advance(5 * 60_000);
    const ackTime = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig:x",
      event: { kind: "operator_acknowledged", operatorUserId: "user_oncall" },
      actor: { userId: "user_oncall" },
      now: ackTime,
    });
    const session = await readAlertEscalationSession(repo, { organizationId: "o", signalRef: "sig:x" });
    expect(session?.status).toBe("acknowledged");
    expect(session?.acknowledgedAt?.getTime()).toBe(ackTime.getTime());
    expect(session?.acknowledgedByUserId).toBe("user_oncall");
  });

  it("operator_snoozed stamps snoozedUntilAt = now + snoozeMinutes", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    const snoozeAt = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 30 },
      actor: { userId: "u" }, now: snoozeAt,
    });
    const session = await readAlertEscalationSession(repo, { organizationId: "o", signalRef: "sig" });
    expect(session?.status).toBe("snoozed");
    expect(session?.snoozedUntilAt?.getTime()).toBe(snoozeAt.getTime() + 30 * 60_000);
  });

  it("snooze_expired clears snoozedUntilAt and re-fires", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 5 }, actor: { userId: "u" }, now: repo._now() });
    repo._advance(5 * 60_000 + 1);
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "snooze_expired" },
      actor: { systemLabel: "snooze-cron" }, now: repo._now(),
    });
    const session = await readAlertEscalationSession(repo, { organizationId: "o", signalRef: "sig" });
    expect(session?.status).toBe("fired");
    expect(session?.snoozedUntilAt).toBeNull();
  });

  it("operator_resolved stamps resolvedAt + resolvedByUserId", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    const resolveAt = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "operator_resolved", operatorUserId: "user_42" },
      actor: { userId: "user_42" }, now: resolveAt,
    });
    const session = await readAlertEscalationSession(repo, { organizationId: "o", signalRef: "sig" });
    expect(session?.status).toBe("resolved");
    expect(session?.resolvedAt?.getTime()).toBe(resolveAt.getTime());
    expect(session?.resolvedByUserId).toBe("user_42");
  });

  it("firstFiredAt is set on the FIRST fire and survives subsequent re-fires", async () => {
    const repo = makeRepo();
    repo._advance(0);
    const firstFireTime = repo._now();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: firstFireTime });

    // Auto-resolve + re-fire later.
    repo._advance(3 * 60_000);
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_cleared" }, actor: { systemLabel: "b" }, now: repo._now() });
    repo._advance(10 * 60_000);
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });

    const session = await readAlertEscalationSession(repo, { organizationId: "o", signalRef: "sig" });
    expect(session?.firstFiredAt?.getTime()).toBe(firstFireTime.getTime());
  });
});

describe("applyAlertEscalationEvent — illegal transitions are still audited", () => {
  it("signal_fired from already-fired status writes isLegal:false row, status unchanged", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    const r = await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "b" }, now: repo._now(),
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.session.status).toBe("fired");
    expect(repo._transitions).toHaveLength(2);
    expect(repo._transitions[1].isLegal).toBe(false);
    expect(repo._transitions[1].rejectionReason).toBe("illegal_transition");
  });
});

describe("listRecentAlertTransitions + scope isolation", () => {
  it("returns transitions newest-first", async () => {
    const repo = makeRepo();
    for (const e of [
      { kind: "signal_fired" as const, signalRef: "sig" },
      { kind: "escalation_triggered" as const },
      { kind: "operator_acknowledged" as const, operatorUserId: "u" },
    ]) {
      repo._advance(60_000);
      await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: e, actor: { systemLabel: "x" }, now: repo._now() });
    }
    const session = await readAlertEscalationSession(repo, { organizationId: "o", signalRef: "sig" });
    const recent = await listRecentAlertTransitions(repo, { sessionId: session!.id, take: 10 });
    expect(recent.map((t) => t.eventKind)).toEqual(["operator_acknowledged", "escalation_triggered", "signal_fired"]);
  });

  it("does not bleed transitions across (org, signalRef) pairs", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "org_a", signalRef: "sig_1", event: { kind: "signal_fired", signalRef: "sig_1" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "org_b", signalRef: "sig_1", event: { kind: "signal_fired", signalRef: "sig_1" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "org_a", signalRef: "sig_2", event: { kind: "signal_fired", signalRef: "sig_2" }, actor: { systemLabel: "b" }, now: repo._now() });
    expect(repo._sessions).toHaveLength(3);
  });
});

describe("isKnownAlertStatus", () => {
  it("accepts every kernel status and rejects garbage", () => {
    const KNOWN: AlertEscalationStatus[] = ["quiet", "fired", "escalated", "acknowledged", "snoozed", "resolved", "auto_resolved", "expired"];
    for (const s of KNOWN) expect(isKnownAlertStatus(s)).toBe(true);
    for (const s of ["", "FIRED", "pending", "alerting"]) expect(isKnownAlertStatus(s)).toBe(false);
  });
});
