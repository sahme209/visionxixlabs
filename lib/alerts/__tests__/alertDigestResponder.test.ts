import { describe, expect, it } from "vitest";
import { buildAlertDigestResponse } from "../alertDigestResponder";
import { applyAlertEscalationEvent } from "../alertEscalationRepo";
import type {
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "../alertEscalationRepo";
import type { AlertSnapshotRepo } from "../alertEscalationSnapshot";

interface Stub extends AlertSnapshotRepo {
  _now(): Date;
}

function makeRepo(): Stub {
  const sessions: AlertEscalationSessionRow[] = [];
  const transitions: AlertEscalationTransitionRow[] = [];
  const start = new Date("2026-05-25T12:00:00Z");
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(start.getTime() + counter * 1000);

  const repo: Stub = {
    _now() { return now(); },
    alertEscalationSession: {
      async findUnique({ where }) {
        const { organizationId, signalRef } = where.organizationId_signalRef;
        const row = sessions.find((s) => s.organizationId === organizationId && s.signalRef === signalRef);
        return row ? { ...row } : null;
      },
      async findMany({ where }) {
        return sessions.filter((s) => s.organizationId === where.organizationId).map((s) => ({ ...s }));
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

describe("buildAlertDigestResponse — happy path", () => {
  it("empty org → 200 with alerts:[]", async () => {
    const repo = makeRepo();
    const r = await buildAlertDigestResponse(repo, "o");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    if (!r.body.ok) return;
    expect(r.body.data.alerts).toEqual([]);
    expect(r.body.data.summary.total).toBe(0);
    expect(typeof r.body.data.generatedAt).toBe("string");
  });

  it("fired alert → 200 with one alert + Acknowledge CTA", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" },
      now: repo._now(),
    });
    const r = await buildAlertDigestResponse(repo, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.alerts).toHaveLength(1);
    expect(r.body.data.alerts[0].suggested.ctaLabel).toBe("Acknowledge");
  });
});

describe("buildAlertDigestResponse — graceful degradation", () => {
  it("P2021-shaped error → 503 migration_pending", async () => {
    const repo = makeRepo();
    repo.alertEscalationSession.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildAlertDigestResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error body");
    expect(r.body.error).toBe("migration_pending");
  });

  it("unknown error → 500 internal_error with correlationId pass-through", async () => {
    const repo = makeRepo();
    repo.alertEscalationSession.findMany = async () => { throw new Error("ECONNREFUSED"); };
    const r = await buildAlertDigestResponse(repo, "o", { correlationId: "cid_99" });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error body");
    expect(r.body.error).toBe("internal_error");
    expect(r.body.correlationId).toBe("cid_99");
  });
});
