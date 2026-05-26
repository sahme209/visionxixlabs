import { describe, expect, it } from "vitest";
import {
  buildPendingAlertNotifications,
  requiresExternalDispatch,
  type PendingDispatchRepo,
} from "../alertNotificationDispatch";
import { applyAlertEscalationEvent } from "../alertEscalationRepo";
import type {
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "../alertEscalationRepo";

/* ──────────────────────────────────────────────────────────────────
   In-memory stub for the PendingDispatchRepo.

   The repo contract requires two findMany overloads on transitions —
   the existing newest-first take=N and a new windowed createdAt>=since
   asc order. The stub honors both based on what fields the args carry.
   ────────────────────────────────────────────────────────────── */

interface Stub extends PendingDispatchRepo {
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
    _now() { return new Date(clock); },
    _advance(ms) { clock = new Date(clock.getTime() + ms); },
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
      async findMany(args: { where: { sessionId: string; createdAt?: { gte: Date } }; orderBy: { createdAt: "asc" | "desc" }; take?: number }) {
        const rows = transitions.filter((t) => t.sessionId === args.where.sessionId);
        const filtered = args.where.createdAt?.gte
          ? rows.filter((t) => t.createdAt >= args.where.createdAt!.gte)
          : rows;
        filtered.sort((a, b) =>
          args.orderBy.createdAt === "asc"
            ? a.createdAt.getTime() - b.createdAt.getTime()
            : b.createdAt.getTime() - a.createdAt.getTime(),
        );
        return (args.take ? filtered.slice(0, args.take) : filtered).map((t) => ({ ...t }));
      },
    },
    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

/* ──────────────────────────────────────────────────────────────────
   Pure helper.
   ────────────────────────────────────────────────────────────── */

describe("requiresExternalDispatch — channel classification", () => {
  it("audit_log only → false (no external push needed)", () => {
    expect(requiresExternalDispatch({
      severity: "info", subject: "x", body: "y",
      channels: ["audit_log"], idempotencyKey: "k",
    })).toBe(false);
  });

  it("team_chat present → true", () => {
    expect(requiresExternalDispatch({
      severity: "high", subject: "x", body: "y",
      channels: ["team_chat", "audit_log"], idempotencyKey: "k",
    })).toBe(true);
  });

  it("oncall_pager present → true", () => {
    expect(requiresExternalDispatch({
      severity: "critical", subject: "x", body: "y",
      channels: ["oncall_pager", "team_chat", "audit_log"], idempotencyKey: "k",
    })).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Discovery.
   ────────────────────────────────────────────────────────────── */

describe("buildPendingAlertNotifications — empty + filtered", () => {
  it("empty org → []", async () => {
    const repo = makeRepo();
    const out = await buildPendingAlertNotifications(repo, "o", { sinceAt: repo._now() });
    expect(out).toEqual([]);
  });

  it("transitions before `sinceAt` are excluded", async () => {
    const repo = makeRepo();
    repo._advance(0);
    const t0 = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge:sticky-error" },
      now: t0,
    });
    repo._advance(10 * 60_000);
    const since = repo._now();
    repo._advance(60_000);
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "operator_acknowledged", operatorUserId: "u" },
      actor: { userId: "u" }, now: repo._now(),
    });
    const out = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    // Only operator_acknowledged should be in the result — the fire was before `since`.
    expect(out).toHaveLength(1);
    expect(out[0].notification.severity).toBe("info");
  });
});

describe("buildPendingAlertNotifications — sort order", () => {
  it("returns chronological across DIFFERENT sessions (org-wide sort)", async () => {
    const repo = makeRepo();
    const since = repo._now();

    repo._advance(60_000);
    const t1 = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig_a",
      event: { kind: "signal_fired", signalRef: "sig_a" },
      actor: { systemLabel: "bridge" }, now: t1,
    });

    repo._advance(60_000);
    const t2 = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig_b",
      event: { kind: "signal_fired", signalRef: "sig_b" },
      actor: { systemLabel: "bridge" }, now: t2,
    });

    repo._advance(60_000);
    const t3 = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig_a",
      event: { kind: "escalation_triggered" },
      actor: { systemLabel: "escalation-policy:default" }, now: t3,
    });

    const out = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    expect(out.map((e) => e.signalRef)).toEqual(["sig_a", "sig_b", "sig_a"]);
    expect(out.map((e) => e.notification.severity)).toEqual(["high", "high", "critical"]);
    // ascending by occurredAt
    expect(out[0].occurredAt.getTime()).toBeLessThanOrEqual(out[1].occurredAt.getTime());
    expect(out[1].occurredAt.getTime()).toBeLessThanOrEqual(out[2].occurredAt.getTime());
  });
});

describe("buildPendingAlertNotifications — externalOnly filter", () => {
  it("with externalOnly: drops info/low events that are audit-only", async () => {
    const repo = makeRepo();
    const since = repo._now();

    repo._advance(60_000);
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    repo._advance(60_000);
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "operator_acknowledged", operatorUserId: "u" },
      actor: { userId: "u" }, now: repo._now(),
    });

    const all = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    expect(all.map((e) => e.notification.severity)).toEqual(["high", "info"]);

    const externalOnly = await buildPendingAlertNotifications(repo, "o", { sinceAt: since, externalOnly: true });
    expect(externalOnly.map((e) => e.notification.severity)).toEqual(["high"]);
  });
});

describe("buildPendingAlertNotifications — illegal transitions skipped", () => {
  it("illegal-transition rows produce no notification entry", async () => {
    const repo = makeRepo();
    const since = repo._now();

    // signal_fired from fired is illegal — kernel writes the audit row
    // but builder returns null for isLegal:false.
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" }, // illegal
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });

    const out = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    expect(out).toHaveLength(1); // only the legal fire is in the dispatch plan
    expect(out[0].notification.severity).toBe("high");
  });
});

describe("buildPendingAlertNotifications — idempotency keys are stable + distinct", () => {
  it("every entry carries the Phase 435 idempotency key shape", async () => {
    const repo = makeRepo();
    const since = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    const out = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    expect(out[0].notification.idempotencyKey).toContain(out[0].sessionId);
    expect(out[0].notification.idempotencyKey).toContain(out[0].transitionId);
    expect(out[0].notification.idempotencyKey).toContain("signal_fired");
  });

  it("calling discovery twice with the same sinceAt returns same keys (safe to retry the dispatcher loop)", async () => {
    const repo = makeRepo();
    const since = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "o", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    const a = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    const b = await buildPendingAlertNotifications(repo, "o", { sinceAt: since });
    expect(a.map((e) => e.notification.idempotencyKey)).toEqual(b.map((e) => e.notification.idempotencyKey));
  });
});

describe("buildPendingAlertNotifications — cross-org isolation", () => {
  it("org_a's transitions do not leak into org_b's discovery", async () => {
    const repo = makeRepo();
    const since = repo._now();
    await applyAlertEscalationEvent(repo, {
      organizationId: "org_a", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    await applyAlertEscalationEvent(repo, {
      organizationId: "org_b", signalRef: "sig",
      event: { kind: "signal_fired", signalRef: "sig" },
      actor: { systemLabel: "bridge" }, now: repo._now(),
    });
    const a = await buildPendingAlertNotifications(repo, "org_a", { sinceAt: since });
    const b = await buildPendingAlertNotifications(repo, "org_b", { sinceAt: since });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].sessionId).not.toBe(b[0].sessionId);
  });
});
