import { describe, expect, it } from "vitest";
import { buildOrgAlertDigest } from "../alertEscalationDigest";
import { applyAlertEscalationEvent } from "../alertEscalationRepo";
import type {
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "../alertEscalationRepo";
import type { AlertSnapshotRepo } from "../alertEscalationSnapshot";

interface Stub extends AlertSnapshotRepo {
  _now(): Date;
  _advance(ms: number): void;
}

function makeRepo(start = new Date("2026-05-25T12:00:00Z")): Stub {
  const sessions: AlertEscalationSessionRow[] = [];
  const transitions: AlertEscalationTransitionRow[] = [];
  let clock = new Date(start);
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;

  const repo: Stub = {
    _advance(ms) { clock = new Date(clock.getTime() + ms); },
    _now() { return new Date(clock); },
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
          lastTransitionAt: new Date(clock), createdAt: new Date(clock), updatedAt: new Date(clock),
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

describe("buildOrgAlertDigest — empty org", () => {
  it("empty → alerts:[] + zeroed summary", async () => {
    const repo = makeRepo();
    const d = await buildOrgAlertDigest(repo, "o");
    expect(d.alerts).toEqual([]);
    expect(d.summary.total).toBe(0);
  });
});

describe("buildOrgAlertDigest — composes CTA + timeline", () => {
  it("fired alert → primary 'Acknowledge' CTA + timeline contains fire line", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "connector_setup:aws:org_42",
      event: { kind: "signal_fired", signalRef: "connector_setup:aws:org_42" },
      actor: { systemLabel: "bridge:sticky-error" },
      now: repo._now(),
    });
    const d = await buildOrgAlertDigest(repo, "o", { now: repo._now() });
    expect(d.alerts).toHaveLength(1);
    const a = d.alerts[0];
    expect(a.status).toBe("fired");
    expect(a.suggested.ctaLabel).toBe("Acknowledge");
    expect(a.suggested.tone).toBe("primary");
    expect(a.timeline[0].text).toContain("fired the alert");
  });

  it("snoozed alert with 20 minutes remaining → secondary CTA + 'snooze ends in 20 minutes' hint", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 30 }, actor: { userId: "u" }, now: repo._now() });
    repo._advance(10 * 60_000);
    const d = await buildOrgAlertDigest(repo, "o", { now: repo._now() });
    const a = d.alerts[0];
    expect(a.suggested.tone).toBe("secondary");
    expect(a.suggested.hint).toMatch(/20 minutes/);
  });

  it("escalated alert → danger tone CTA (on-call has been paged)", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "escalation_triggered" }, actor: { systemLabel: "escalation-policy:default" }, now: repo._now() });
    const d = await buildOrgAlertDigest(repo, "o", { now: repo._now() });
    expect(d.alerts[0].suggested.tone).toBe("danger");
  });

  it("resolved alert → none-tone CTA (no action), open=false, terminal=true", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "operator_resolved", operatorUserId: "u" }, actor: { userId: "u" }, now: repo._now() });
    const d = await buildOrgAlertDigest(repo, "o", { now: repo._now() });
    const a = d.alerts[0];
    expect(a.suggested.tone).toBe("none");
    expect(a.open).toBe(false);
    expect(a.terminal).toBe(true);
    expect(a.resolvedByUserId).toBe("u");
  });
});

describe("buildOrgAlertDigest — timeline newest-first with monotone age", () => {
  it("multi-event session orders newest first", async () => {
    const repo = makeRepo();
    for (const e of [
      { kind: "signal_fired" as const, signalRef: "sig" },
      { kind: "escalation_triggered" as const },
      { kind: "operator_acknowledged" as const, operatorUserId: "u" },
    ]) {
      repo._advance(60_000);
      await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: e, actor: { systemLabel: "x" }, now: repo._now() });
    }
    repo._advance(60_000);
    const d = await buildOrgAlertDigest(repo, "o", { now: repo._now() });
    const tl = d.alerts[0].timeline;
    expect(tl[0].text).toContain("acknowledged");
    expect(tl[1].text).toContain("escalated to on-call");
    expect(tl[2].text).toContain("fired the alert");
    expect(tl[0].ageSeconds).toBeLessThanOrEqual(tl[1].ageSeconds);
    expect(tl[1].ageSeconds).toBeLessThanOrEqual(tl[2].ageSeconds);
  });
});
