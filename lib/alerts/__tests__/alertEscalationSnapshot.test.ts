import { describe, expect, it } from "vitest";
import { applyAlertEscalationEvent } from "../alertEscalationRepo";
import type {
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "../alertEscalationRepo";
import {
  attentionRank,
  buildOrgAlertSnapshot,
  sidebarToneFor,
  type AlertSnapshotRepo,
} from "../alertEscalationSnapshot";
import type { AlertEscalationStatus } from "../alertEscalationSession";

/* ──────────────────────────────────────────────────────────────────
   Stub.
   ────────────────────────────────────────────────────────────── */

interface Stub extends AlertSnapshotRepo {
  _sessions: AlertEscalationSessionRow[];
  _transitions: AlertEscalationTransitionRow[];
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
      async findMany({ where }) {
        return sessions.filter((s) => s.organizationId === where.organizationId).map((s) => ({ ...s }));
      },
      async create({ data }) {
        const row: AlertEscalationSessionRow = {
          id: nextId(),
          organizationId: data.organizationId, signalRef: data.signalRef,
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
   Pure helpers.
   ────────────────────────────────────────────────────────────── */

describe("sidebarToneFor — every status maps to a stable tone", () => {
  const cases: Array<[AlertEscalationStatus, "red" | "amber" | "blue" | "emerald" | "zinc"]> = [
    ["fired",         "red"],
    ["escalated",     "red"],
    ["acknowledged",  "amber"],
    ["snoozed",       "amber"],
    ["resolved",      "emerald"],
    ["auto_resolved", "emerald"],
    ["expired",       "blue"],
    ["quiet",         "zinc"],
  ];
  it.each(cases)("%s → %s", (s, tone) => {
    expect(sidebarToneFor(s)).toBe(tone);
  });
});

describe("attentionRank — strict ordering", () => {
  it("waiting < acknowledged < snoozed < terminal < quiet", () => {
    expect(attentionRank("fired")).toBeLessThan(attentionRank("acknowledged"));
    expect(attentionRank("acknowledged")).toBeLessThan(attentionRank("snoozed"));
    expect(attentionRank("snoozed")).toBeLessThan(attentionRank("resolved"));
    expect(attentionRank("resolved")).toBeLessThan(attentionRank("quiet"));
  });
});

/* ──────────────────────────────────────────────────────────────────
   Integration.
   ────────────────────────────────────────────────────────────── */

describe("buildOrgAlertSnapshot — empty + populated", () => {
  it("empty org → alerts:[], summary zeroed", async () => {
    const repo = makeRepo();
    const s = await buildOrgAlertSnapshot(repo, "o");
    expect(s.alerts).toEqual([]);
    expect(s.summary).toEqual({ total: 0, waitingForHuman: 0, open: 0, terminal: 0, quiet: 0 });
  });

  it("sorts by attention: waiting_for_human → acknowledged → snoozed → terminal", async () => {
    const repo = makeRepo();
    // Three signals, push each to a different status.
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_a", event: { kind: "signal_fired", signalRef: "sig_a" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_a", event: { kind: "escalation_triggered" }, actor: { systemLabel: "cron" }, now: repo._now() });

    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_b", event: { kind: "signal_fired", signalRef: "sig_b" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_b", event: { kind: "operator_acknowledged", operatorUserId: "u" }, actor: { userId: "u" }, now: repo._now() });

    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_c", event: { kind: "signal_fired", signalRef: "sig_c" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_c", event: { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 15 }, actor: { userId: "u" }, now: repo._now() });

    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_d", event: { kind: "signal_fired", signalRef: "sig_d" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig_d", event: { kind: "operator_resolved", operatorUserId: "u" }, actor: { userId: "u" }, now: repo._now() });

    const s = await buildOrgAlertSnapshot(repo, "o", { now: repo._now() });
    expect(s.alerts.map((a) => a.signalRef)).toEqual(["sig_a", "sig_b", "sig_c", "sig_d"]);
    expect(s.summary).toEqual({ total: 4, waitingForHuman: 1, open: 3, terminal: 1, quiet: 0 });
  });
});

describe("buildOrgAlertSnapshot — derived time fields", () => {
  it("minutesSinceFirstFire computed from injected now", async () => {
    const repo = makeRepo(new Date("2026-05-25T12:00:00Z"));
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    repo._advance(8 * 60_000);
    const s = await buildOrgAlertSnapshot(repo, "o", { now: repo._now() });
    expect(s.alerts[0].minutesSinceFirstFire).toBe(8);
  });

  it("minutesUntilSnoozeExpires counts down from snoozedUntilAt", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 30 }, actor: { userId: "u" }, now: repo._now() });
    repo._advance(10 * 60_000);
    const s = await buildOrgAlertSnapshot(repo, "o", { now: repo._now() });
    expect(s.alerts[0].minutesUntilSnoozeExpires).toBe(20);
  });

  it("minutesUntilSnoozeExpires is null after the snooze deadline passed", async () => {
    const repo = makeRepo();
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "signal_fired", signalRef: "sig" }, actor: { systemLabel: "b" }, now: repo._now() });
    await applyAlertEscalationEvent(repo, { organizationId: "o", signalRef: "sig", event: { kind: "operator_snoozed", operatorUserId: "u", snoozeMinutes: 5 }, actor: { userId: "u" }, now: repo._now() });
    repo._advance(10 * 60_000); // past the 5-minute snooze
    const s = await buildOrgAlertSnapshot(repo, "o", { now: repo._now() });
    expect(s.alerts[0].minutesUntilSnoozeExpires).toBeNull();
  });

  it("minutesSinceFirstFire is null for a session that never fired", async () => {
    const repo = makeRepo();
    // Force-create a quiet session via signal_fired then resolve to quiet
    // pathway — wait that won't work. Instead, just check the fresh-create
    // case where create() returns a row with firstFiredAt: null.
    // Use the operator_acknowledged from quiet — illegal, audit row only.
    // So no firstFiredAt set.
    const r = await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "operator_acknowledged", operatorUserId: "u" },
      actor: { userId: "u" }, now: repo._now(),
    });
    expect(r.ok).toBe(false);
    const snap = await buildOrgAlertSnapshot(repo, "o", { now: repo._now() });
    expect(snap.alerts[0].minutesSinceFirstFire).toBeNull();
  });
});

describe("buildOrgAlertSnapshot — recentTransitions monotone age", () => {
  it("returns newest-first transitions with non-decreasing ages", async () => {
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
    const s = await buildOrgAlertSnapshot(repo, "o", { now: repo._now() });
    const txs = s.alerts[0].recentTransitions;
    expect(txs[0].eventKind).toBe("operator_acknowledged");
    expect(txs[1].eventKind).toBe("escalation_triggered");
    expect(txs[2].eventKind).toBe("signal_fired");
    expect(txs[0].ageSeconds).toBeLessThanOrEqual(txs[1].ageSeconds);
    expect(txs[1].ageSeconds).toBeLessThanOrEqual(txs[2].ageSeconds);
  });
});
