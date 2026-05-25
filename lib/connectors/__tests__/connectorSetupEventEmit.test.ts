import { describe, expect, it } from "vitest";
import {
  isAllowedProvider,
  isOperatorAllowedEventKind,
  OPERATOR_ALLOWED_EVENT_KINDS,
  recordConnectorSetupEvent,
} from "../connectorSetupEventEmit";
import type {
  ConnectorSetupRepo,
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "../connectorSetupRepo";

/* ──────────────────────────────────────────────────────────────────
   Phase 424 — minimal in-memory repo stub matching the Phase 414 contract.
   ────────────────────────────────────────────────────────────── */

interface Stub extends ConnectorSetupRepo {
  _sessions: ConnectorSetupSessionRow[];
  _transitions: ConnectorSetupTransitionRow[];
}

function makeRepo(): Stub {
  const sessions: ConnectorSetupSessionRow[] = [];
  const transitions: ConnectorSetupTransitionRow[] = [];
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(2026, 0, 1, 0, 0, counter);

  const repo: Stub = {
    _sessions: sessions,
    _transitions: transitions,
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
          lastEventKind: null, lastErrorCode: null,
          firstConnectedAt: null, lastTransitionAt: now(),
          createdAt: now(), updatedAt: now(),
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
    connectorSetupTransition: {
      async create({ data }) {
        const row: ConnectorSetupTransitionRow = { id: nextId(), createdAt: now(), ...data };
        transitions.push(row);
        return { ...row };
      },
      async findMany() { return []; },
    },
    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers.
   ────────────────────────────────────────────────────────────── */

describe("isAllowedProvider / isOperatorAllowedEventKind — closed-union guards", () => {
  it("isAllowedProvider accepts only aws/azure/gcp", () => {
    for (const p of ["aws", "azure", "gcp"]) expect(isAllowedProvider(p)).toBe(true);
    for (const p of ["AWS", "github", "", "stripe"]) expect(isAllowedProvider(p)).toBe(false);
  });

  it("isOperatorAllowedEventKind accepts only the 4 operator-driven kinds", () => {
    for (const k of OPERATOR_ALLOWED_EVENT_KINDS) expect(isOperatorAllowedEventKind(k)).toBe(true);
    // Server-side kinds are explicitly rejected — operators can't fake them.
    for (const k of ["validation_succeeded", "validation_failed", "health_check_regressed", "health_check_recovered", "provider_revoked_credentials"]) {
      expect(isOperatorAllowedEventKind(k)).toBe(false);
    }
  });
});

/* ──────────────────────────────────────────────────────────────────
   recordConnectorSetupEvent — happy paths.
   ────────────────────────────────────────────────────────────── */

describe("recordConnectorSetupEvent — applies legal operator events", () => {
  it("operator_started on a fresh session lands at setup_started, persists a transition", async () => {
    const repo = makeRepo();
    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "operator_started", actorUserId: "user_1",
    });
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied") return;
    expect(r.result.ok).toBe(true);
    if (!r.result.ok) return;
    expect(r.result.nextStatus).toBe("setup_started");
    expect(repo._transitions).toHaveLength(1);
    expect(repo._transitions[0].actorUserId).toBe("user_1");
  });

  it("operator_disconnected from connected lands at disconnected", async () => {
    const repo = makeRepo();
    // Walk to connected via direct repo calls, then emit operator_disconnected.
    for (const eventKind of ["operator_started", "provider_link_opened", "bounce_back_received"] as const) {
      await recordConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", eventKind, actorUserId: "u" });
    }
    // bounce_back_received → validating. We need a server-side validation_succeeded to get to connected.
    // Direct repo call to simulate the server validator that DOES allow that.
    const { applyConnectorSetupEvent } = await import("../connectorSetupRepo");
    await applyConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      event: { kind: "validation_succeeded" },
      actor: { systemLabel: "validator:test" },
    });
    expect(repo._sessions[0].status).toBe("connected");

    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "operator_disconnected", actorUserId: "u",
    });
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied" || !r.result.ok) throw new Error("expected legal apply");
    expect(r.result.nextStatus).toBe("disconnected");
  });
});

/* ──────────────────────────────────────────────────────────────────
   recordConnectorSetupEvent — validation rejections.
   ────────────────────────────────────────────────────────────── */

describe("recordConnectorSetupEvent — validation rejections never reach the repo", () => {
  it("unknown_provider short-circuits before any DB call", async () => {
    const repo = makeRepo();
    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "github",
      eventKind: "operator_started", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "validation_failed", reason: "unknown_provider" });
    expect(repo._sessions).toHaveLength(0);
    expect(repo._transitions).toHaveLength(0);
  });

  it("operator-spoofed server-side event → event_kind_not_operator_allowed", async () => {
    const repo = makeRepo();
    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "validation_succeeded", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "validation_failed", reason: "event_kind_not_operator_allowed" });
    expect(repo._sessions).toHaveLength(0);
  });

  it("garbage event kind → unknown_event_kind", async () => {
    const repo = makeRepo();
    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "haxxor_takeover", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "validation_failed", reason: "unknown_event_kind" });
  });
});

/* ──────────────────────────────────────────────────────────────────
   recordConnectorSetupEvent — graceful degradation pre-migration.
   ────────────────────────────────────────────────────────────── */

describe("recordConnectorSetupEvent — missing-table swallowed, other errors propagate", () => {
  it("P2021-shaped error → returns migration_pending without throwing", async () => {
    const repo = makeRepo();
    repo.connectorSetupSession.findUnique = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "operator_started", actorUserId: "u",
    });
    expect(r).toEqual({ kind: "migration_pending" });
  });

  it("unrelated error (e.g. connection refused) propagates", async () => {
    const repo = makeRepo();
    repo.connectorSetupSession.findUnique = async () => { throw new Error("ECONNREFUSED"); };
    await expect(recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "operator_started", actorUserId: "u",
    })).rejects.toThrow(/ECONNREFUSED/);
  });
});

/* ──────────────────────────────────────────────────────────────────
   recordConnectorSetupEvent — illegal transitions surface honestly.
   ────────────────────────────────────────────────────────────── */

describe("recordConnectorSetupEvent — kernel-illegal transitions still report applied", () => {
  it("operator_disconnected from not_connected → applied with ok:false (audit-visible reject)", async () => {
    const repo = makeRepo();
    const r = await recordConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      eventKind: "operator_disconnected", actorUserId: "u",
    });
    expect(r.kind).toBe("applied");
    if (r.kind !== "applied") return;
    expect(r.result.ok).toBe(false);
    // The audit row was still written so the operator's failed click is debuggable.
    expect(repo._transitions).toHaveLength(1);
    expect(repo._transitions[0].isLegal).toBe(false);
  });
});
