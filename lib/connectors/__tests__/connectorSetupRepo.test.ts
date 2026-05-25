import { beforeEach, describe, expect, it } from "vitest";
import {
  applyConnectorSetupEvent,
  isKnownStatus,
  listRecentTransitions,
  readConnectorSetupSession,
  type ConnectorSetupRepo,
  type ConnectorSetupSessionRow,
  type ConnectorSetupTransitionRow,
} from "../connectorSetupRepo";
import type { ConnectorSetupStatus } from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 414 — in-memory Prisma stub.

   Mirrors the narrow ConnectorSetupRepo contract. Generates IDs +
   timestamps deterministically so assertions stay readable, and keeps
   transactions naive (no rollback) — the kernel already throws nothing,
   so the txn never aborts in the tested paths.
   ────────────────────────────────────────────────────────────── */

function makeRepo(): ConnectorSetupRepo & { _sessions: ConnectorSetupSessionRow[]; _transitions: ConnectorSetupTransitionRow[]; _counter: { n: number } } {
  const sessions: ConnectorSetupSessionRow[] = [];
  const transitions: ConnectorSetupTransitionRow[] = [];
  const counter = { n: 0 };

  const nextId = () => `id_${(counter.n += 1)}`;
  const now = () => new Date(2026, 0, 1, 0, 0, counter.n);

  const repo: ConnectorSetupRepo & { _sessions: typeof sessions; _transitions: typeof transitions; _counter: typeof counter } = {
    _sessions: sessions,
    _transitions: transitions,
    _counter: counter,

    connectorSetupSession: {
      async findUnique({ where }) {
        const { organizationId, provider } = where.organizationId_provider;
        const row = sessions.find((s) => s.organizationId === organizationId && s.provider === provider);
        return row ? { ...row } : null;
      },
      async create({ data }) {
        const row: ConnectorSetupSessionRow = {
          id: nextId(),
          organizationId: data.organizationId,
          provider: data.provider,
          status: "not_connected",
          lastEventKind: null,
          lastErrorCode: null,
          firstConnectedAt: null,
          lastTransitionAt: now(),
          createdAt: now(),
          updatedAt: now(),
        };
        sessions.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = sessions.find((s) => s.id === where.id);
        if (!row) throw new Error(`stub: session ${where.id} not found`);
        Object.assign(row, data, { updatedAt: now() });
        return { ...row };
      },
    },

    connectorSetupTransition: {
      async create({ data }) {
        const row: ConnectorSetupTransitionRow = {
          id: nextId(),
          createdAt: now(),
          ...data,
        };
        transitions.push(row);
        return row;
      },
      async findMany({ where, take }) {
        return transitions
          .filter((t) => t.sessionId === where.sessionId)
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, take);
      },
    },

    async $transaction(fn) {
      return fn(repo);
    },
  };

  return repo;
}

describe("applyConnectorSetupEvent — creates session lazily + persists legal transition", () => {
  let repo: ReturnType<typeof makeRepo>;
  beforeEach(() => { repo = makeRepo(); });

  it("creates a not_connected session row when none exists, then moves to setup_started", async () => {
    const result = await applyConnectorSetupEvent(repo, {
      organizationId: "org_1",
      provider: "aws",
      event: { kind: "operator_started" },
      actor: { userId: "user_1" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.previousStatus).toBe("not_connected");
    expect(result.nextStatus).toBe("setup_started");
    expect(result.session.status).toBe("setup_started");
    expect(result.session.lastEventKind).toBe("operator_started");
    expect(repo._sessions).toHaveLength(1);
    expect(repo._transitions).toHaveLength(1);
    expect(repo._transitions[0].isLegal).toBe(true);
    expect(repo._transitions[0].actorUserId).toBe("user_1");
  });

  it("idempotent on session creation — second call reuses the same row", async () => {
    await applyConnectorSetupEvent(repo, {
      organizationId: "org_1", provider: "aws",
      event: { kind: "operator_started" }, actor: { userId: "user_1" },
    });
    await applyConnectorSetupEvent(repo, {
      organizationId: "org_1", provider: "aws",
      event: { kind: "provider_link_opened" }, actor: { userId: "user_1" },
    });
    expect(repo._sessions).toHaveLength(1);
    expect(repo._sessions[0].status).toBe("waiting_for_provider");
    expect(repo._transitions).toHaveLength(2);
  });
});

describe("applyConnectorSetupEvent — illegal transitions are persisted with isLegal:false", () => {
  it("rejects provider_link_opened from not_connected and writes an illegal-transition row", async () => {
    const repo = makeRepo();
    const result = await applyConnectorSetupEvent(repo, {
      organizationId: "org_1", provider: "aws",
      event: { kind: "provider_link_opened" }, actor: { userId: "user_1" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("illegal_transition");
    expect(result.from).toBe("not_connected");
    expect(result.session.status).toBe("not_connected"); // unchanged
    expect(repo._transitions).toHaveLength(1);
    expect(repo._transitions[0].isLegal).toBe(false);
    expect(repo._transitions[0].rejectionReason).toBe("illegal_transition");
    expect(repo._transitions[0].fromStatus).toBe("not_connected");
    expect(repo._transitions[0].toStatus).toBe("not_connected");
  });
});

describe("applyConnectorSetupEvent — system actor + payload + first-connected stamp", () => {
  it("preserves system actor label and validation_failed errorCode in eventPayload", async () => {
    const repo = makeRepo();
    // Walk to validating, then fail with a real errorCode.
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "operator_started" }, actor: { userId: "u" } });
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "provider_link_opened" }, actor: { userId: "u" } });
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "bounce_back_received" }, actor: { userId: "u" } });
    const failed = await applyConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      event: { kind: "validation_failed", errorCode: "AccessDenied" },
      actor: { systemLabel: "validator:aws" },
    });

    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.session.status).toBe("failed");
    expect(failed.session.lastErrorCode).toBe("AccessDenied");
    expect(failed.transition.actorUserId).toBeNull();
    expect(failed.transition.actorLabel).toBe("validator:aws");
    expect(failed.transition.eventPayload).toEqual({ errorCode: "AccessDenied" });
  });

  it("stamps firstConnectedAt only on the FIRST time the session reaches connected", async () => {
    const repo = makeRepo();
    // First full happy path → connected.
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" } });
    }
    const session1 = await readConnectorSetupSession(repo, { organizationId: "o", provider: "aws" });
    expect(session1?.status).toBe("connected");
    expect(session1?.firstConnectedAt).not.toBeNull();
    const stampedAt = session1!.firstConnectedAt!;

    // Now regress + recover. firstConnectedAt must NOT change.
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "health_check_regressed" }, actor: { systemLabel: "cron" } });
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "health_check_recovered" }, actor: { systemLabel: "cron" } });
    const session2 = await readConnectorSetupSession(repo, { organizationId: "o", provider: "aws" });
    expect(session2?.status).toBe("connected");
    expect(session2?.firstConnectedAt?.getTime()).toBe(stampedAt.getTime());
  });
});

describe("listRecentTransitions — sorted desc, capped, scoped to session", () => {
  it("returns transitions newest-first and respects take", async () => {
    const repo = makeRepo();
    const events = [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
      { kind: "health_check_regressed" as const },
      { kind: "health_check_recovered" as const },
    ];
    for (const ev of events) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" } });
    }
    const session = await readConnectorSetupSession(repo, { organizationId: "o", provider: "aws" });
    expect(session).not.toBeNull();
    const recent = await listRecentTransitions(repo, { sessionId: session!.id, take: 3 });
    expect(recent).toHaveLength(3);
    expect(recent[0].eventKind).toBe("health_check_recovered");
    expect(recent[1].eventKind).toBe("health_check_regressed");
    expect(recent[2].eventKind).toBe("validation_succeeded");
  });

  it("does not bleed transitions across sessions", async () => {
    const repo = makeRepo();
    await applyConnectorSetupEvent(repo, { organizationId: "org_a", provider: "aws", event: { kind: "operator_started" }, actor: { userId: "u" } });
    await applyConnectorSetupEvent(repo, { organizationId: "org_b", provider: "aws", event: { kind: "operator_started" }, actor: { userId: "u" } });

    const a = await readConnectorSetupSession(repo, { organizationId: "org_a", provider: "aws" });
    const b = await readConnectorSetupSession(repo, { organizationId: "org_b", provider: "aws" });
    expect(a?.id).not.toBe(b?.id);

    const transitionsA = await listRecentTransitions(repo, { sessionId: a!.id });
    expect(transitionsA).toHaveLength(1);
    expect(transitionsA[0].sessionId).toBe(a!.id);
  });
});

describe("isKnownStatus — guard for legacy rows", () => {
  it("accepts every kernel status and rejects garbage", () => {
    const KNOWN: ConnectorSetupStatus[] = [
      "not_connected", "setup_started", "waiting_for_provider", "validating",
      "connected", "failed", "disconnected", "revoked", "needs_attention",
    ];
    for (const s of KNOWN) expect(isKnownStatus(s)).toBe(true);
    for (const s of ["", "CONNECTED", "init", "active"]) expect(isKnownStatus(s)).toBe(false);
  });
});
