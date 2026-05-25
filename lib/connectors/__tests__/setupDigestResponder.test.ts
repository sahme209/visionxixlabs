import { describe, expect, it } from "vitest";
import { buildSetupDigestResponse, isMissingTable } from "../setupDigestResponder";
import { applyConnectorSetupEvent } from "../connectorSetupRepo";
import type {
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "../connectorSetupRepo";
import type { SnapshotRepo } from "../connectorSetupSnapshot";

/* ──────────────────────────────────────────────────────────────────
   Phase 422 — responder tests.

   The responder is pure orchestration over the digest pipeline. We
   exercise it with the same in-memory stub used by the digest tests
   to confirm:
     - happy path returns 200 + serialized digest
     - missing-table errors flip to 503 / migration_pending
     - unknown errors return 500 with correlationId
   ────────────────────────────────────────────────────────────── */

interface Stub extends SnapshotRepo {
  _sessions: ConnectorSetupSessionRow[];
  _transitions: ConnectorSetupTransitionRow[];
  _now(): Date;
}

function makeRepo(): Stub {
  const sessions: ConnectorSetupSessionRow[] = [];
  const transitions: ConnectorSetupTransitionRow[] = [];
  let counter = 0;
  const start = new Date("2026-05-25T12:00:00Z");
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(start.getTime() + counter * 1000);

  const repo: Stub = {
    _sessions: sessions,
    _transitions: transitions,
    _now() { return now(); },
    connectorSetupSession: {
      async findUnique({ where }) {
        const { organizationId, provider } = where.organizationId_provider;
        const row = sessions.find((s) => s.organizationId === organizationId && s.provider === provider);
        return row ? { ...row } : null;
      },
      async findMany({ where }) {
        return sessions.filter((s) => s.organizationId === where.organizationId).map((s) => ({ ...s }));
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

describe("buildSetupDigestResponse — happy path", () => {
  it("empty org → 200 ok:true, providers:[], summary zeroed", async () => {
    const repo = makeRepo();
    const r = await buildSetupDigestResponse(repo, "o");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    if (!r.body.ok) return;
    expect(r.body.data.providers).toEqual([]);
    expect(r.body.data.summary.total).toBe(0);
    expect(typeof r.body.data.generatedAt).toBe("string");
    expect(r.body.data.generatedAt).toMatch(/T\d{2}:\d{2}:\d{2}/); // ISO
  });

  it("populated org → providers serialized with status, CTA, errorClass, timeline", async () => {
    const repo = makeRepo();
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
    }
    const r = await buildSetupDigestResponse(repo, "o");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    if (!r.body.ok) return;
    expect(r.body.data.providers).toHaveLength(1);
    const p = r.body.data.providers[0];
    expect(p.provider).toBe("aws");
    expect(p.status).toBe("connected");
    expect(p.suggested.ctaLabel).toBe("Disconnect");
    expect(p.errorClass.kind).toBe("healthy");
    expect(p.timeline.length).toBeGreaterThan(0);
  });
});

describe("buildSetupDigestResponse — graceful degradation", () => {
  it("missing-table error (P2021 code) → 503 migration_pending", async () => {
    const repo = makeRepo();
    // Force findMany to throw a Prisma-shaped P2021 error.
    repo.connectorSetupSession.findMany = async () => {
      const err = Object.assign(new Error("The table `public.ConnectorSetupSession` does not exist"), { code: "P2021" });
      throw err;
    };
    const r = await buildSetupDigestResponse(repo, "o");
    expect(r.status).toBe(503);
    expect(r.body.ok).toBe(false);
    if (r.body.ok) return;
    expect(r.body.error).toBe("migration_pending");
    expect(r.body.hint).toMatch(/migrate (dev|deploy)/);
  });

  it("missing-table error (message contains 42P01) → 503 migration_pending", async () => {
    const repo = makeRepo();
    repo.connectorSetupSession.findMany = async () => {
      throw new Error("PG ERROR 42P01: relation \"ConnectorSetupSession\" does not exist");
    };
    const r = await buildSetupDigestResponse(repo, "o");
    expect(r.status).toBe(503);
    expect(r.body.ok).toBe(false);
    if (r.body.ok) return;
    expect(r.body.error).toBe("migration_pending");
  });

  it("unknown error → 500 internal_error with correlationId", async () => {
    const repo = makeRepo();
    repo.connectorSetupSession.findMany = async () => { throw new Error("connection refused"); };
    const r = await buildSetupDigestResponse(repo, "o", { correlationId: "cid_42" });
    expect(r.status).toBe(500);
    expect(r.body.ok).toBe(false);
    if (r.body.ok) return;
    expect(r.body.error).toBe("internal_error");
    expect(r.body.correlationId).toBe("cid_42");
    expect(r.body.hint).toBeUndefined();
  });
});

describe("isMissingTable — exhaustive shape coverage", () => {
  it("detects { code: 'P2021' } shape", () => {
    expect(isMissingTable({ code: "P2021", message: "boom" })).toBe(true);
  });

  it("detects 'relation foo does not exist' message", () => {
    expect(isMissingTable(new Error("relation \"x\" does not exist"))).toBe(true);
  });

  it("detects 42P01 in message", () => {
    expect(isMissingTable(new Error("Postgres responded with 42P01"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingTable(new Error("rate limited"))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable(undefined)).toBe(false);
    expect(isMissingTable("string-error")).toBe(false);
  });
});
