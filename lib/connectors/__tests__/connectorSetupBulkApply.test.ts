import { describe, expect, it } from "vitest";
import { bulkApplyHealthChecks, type BulkApplyItem } from "../connectorSetupBulkApply";
import { applyConnectorSetupEvent } from "../connectorSetupRepo";
import type {
  ConnectorSetupRepo,
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "../connectorSetupRepo";
import type { ConnectorSetupStatus } from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 419 — in-memory repo stub matching the Phase 414/415 shape.
   ────────────────────────────────────────────────────────────── */

interface Stub extends ConnectorSetupRepo {
  _sessions: ConnectorSetupSessionRow[];
  _transitions: ConnectorSetupTransitionRow[];
  _seed(args: { organizationId: string; provider: string; status: ConnectorSetupStatus }): ConnectorSetupSessionRow;
}

function makeRepo(): Stub {
  const sessions: ConnectorSetupSessionRow[] = [];
  const transitions: ConnectorSetupTransitionRow[] = [];
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const start = new Date(2026, 0, 1);
  const now = () => new Date(start.getTime() + counter * 1000);

  const repo: Stub = {
    _sessions: sessions,
    _transitions: transitions,
    _seed(args) {
      const row: ConnectorSetupSessionRow = {
        id: nextId(),
        organizationId: args.organizationId,
        provider: args.provider,
        status: args.status,
        lastEventKind: null,
        lastErrorCode: null,
        firstConnectedAt: args.status === "connected" ? now() : null,
        lastTransitionAt: now(),
        createdAt: now(),
        updatedAt: now(),
      };
      sessions.push(row);
      return { ...row };
    },
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

/* ──────────────────────────────────────────────────────────────────
   Tests.
   ────────────────────────────────────────────────────────────── */

describe("bulkApplyHealthChecks — empty + noop-only batches", () => {
  it("empty items list → empty result + zeroed summary", async () => {
    const repo = makeRepo();
    const r = await bulkApplyHealthChecks(repo, []);
    expect(r.perSession).toEqual([]);
    expect(r.summary).toEqual({ total: 0, applied: 0, appliedLegal: 0, appliedIllegal: 0, noop: 0, errored: 0 });
  });

  it("all sessions in non-actionable states → all noops, no audit rows written", async () => {
    const repo = makeRepo();
    const s1 = repo._seed({ organizationId: "o", provider: "aws",    status: "not_connected" });
    const s2 = repo._seed({ organizationId: "o", provider: "azure",  status: "validating" });
    const s3 = repo._seed({ organizationId: "o", provider: "gcp",    status: "connected" });
    const items: BulkApplyItem[] = [
      { session: s1, probeOutcome: "success" },
      { session: s2, probeOutcome: "auth_failed" },
      { session: s3, probeOutcome: "success" },  // connected + success → noop already_in_target_state
    ];
    const r = await bulkApplyHealthChecks(repo, items);
    expect(r.summary).toEqual({ total: 3, applied: 0, appliedLegal: 0, appliedIllegal: 0, noop: 3, errored: 0 });
    expect(r.perSession.map((o) => o.kind)).toEqual(["noop", "noop", "noop"]);
    expect(repo._transitions).toHaveLength(0);
  });
});

describe("bulkApplyHealthChecks — applies real transitions", () => {
  it("connected + auth_failed → regress; needs_attention + success → recover", async () => {
    const repo = makeRepo();
    const sConnected = repo._seed({ organizationId: "o", provider: "aws",    status: "connected" });
    const sNeedsAttn = repo._seed({ organizationId: "o", provider: "azure",  status: "needs_attention" });
    const items: BulkApplyItem[] = [
      { session: sConnected, probeOutcome: "auth_failed" },
      { session: sNeedsAttn, probeOutcome: "success" },
    ];
    const r = await bulkApplyHealthChecks(repo, items);
    expect(r.summary.applied).toBe(2);
    expect(r.summary.appliedLegal).toBe(2);
    expect(r.summary.appliedIllegal).toBe(0);
    expect(r.summary.noop).toBe(0);

    expect(repo._transitions).toHaveLength(2);
    const awsRow = repo._sessions.find((s) => s.provider === "aws")!;
    const azureRow = repo._sessions.find((s) => s.provider === "azure")!;
    expect(awsRow.status).toBe("needs_attention");
    expect(azureRow.status).toBe("connected");

    // Every applied transition records the configured system actor.
    for (const t of repo._transitions) {
      expect(t.actorLabel).toBe("cron:health-check");
      expect(t.actorUserId).toBeNull();
    }
  });

  it("active + revoked → emits provider_revoked_credentials, session goes to revoked", async () => {
    const repo = makeRepo();
    const s = repo._seed({ organizationId: "o", provider: "aws", status: "connected" });
    const r = await bulkApplyHealthChecks(repo, [{ session: s, probeOutcome: "revoked" }]);
    expect(r.summary.applied).toBe(1);
    expect(repo._sessions[0].status).toBe("revoked");
    expect(repo._transitions[0].eventKind).toBe("provider_revoked_credentials");
  });
});

describe("bulkApplyHealthChecks — custom actor label propagates", () => {
  it("uses opts.actorLabel on every transition", async () => {
    const repo = makeRepo();
    const s = repo._seed({ organizationId: "o", provider: "aws", status: "connected" });
    await bulkApplyHealthChecks(repo, [{ session: s, probeOutcome: "auth_failed" }], { actorLabel: "cron:custom-tick" });
    expect(repo._transitions[0].actorLabel).toBe("cron:custom-tick");
  });
});

describe("bulkApplyHealthChecks — errors are captured, batch continues", () => {
  it("a throwing apply call records errored but lets siblings run", async () => {
    const repo = makeRepo();
    const sBad   = repo._seed({ organizationId: "o", provider: "aws",   status: "connected" });
    const sGood  = repo._seed({ organizationId: "o", provider: "azure", status: "needs_attention" });

    // Make the first applied transition explode (aws — auth_failed) by
    // monkey-patching the transition create.
    const origCreate = repo.connectorSetupTransition.create.bind(repo.connectorSetupTransition);
    let calls = 0;
    repo.connectorSetupTransition.create = async (args) => {
      calls += 1;
      if (calls === 1) throw new Error("disk full");
      return origCreate(args);
    };

    const items: BulkApplyItem[] = [
      { session: sBad,  probeOutcome: "auth_failed" },
      { session: sGood, probeOutcome: "success" },
    ];
    const r = await bulkApplyHealthChecks(repo, items);
    expect(r.summary).toEqual({ total: 2, applied: 1, appliedLegal: 1, appliedIllegal: 0, noop: 0, errored: 1 });
    expect(r.perSession[0].kind).toBe("errored");
    if (r.perSession[0].kind === "errored") {
      expect(r.perSession[0].error).toBe("disk full");
      expect(r.perSession[0].sessionId).toBe(sBad.id);
    }
    expect(r.perSession[1].kind).toBe("applied");
  });
});

describe("bulkApplyHealthChecks — interleaves with manual operator events without conflict", () => {
  it("a session manually advanced mid-batch still produces a coherent audit log", async () => {
    const repo = makeRepo();
    const s = repo._seed({ organizationId: "o", provider: "aws", status: "connected" });

    // Operator disconnects via a direct apply call first (simulates the
    // race a real cron loop could hit).
    await applyConnectorSetupEvent(repo, {
      organizationId: "o", provider: "aws",
      event: { kind: "operator_disconnected" },
      actor: { userId: "user_42" },
    });
    // Now bulk-apply sees the seeded stale `status:connected` but the
    // current DB row is `disconnected`. The kernel will reject
    // health_check_regressed from `disconnected` → recorded as
    // applied/illegal so the audit log captures the race.
    const r = await bulkApplyHealthChecks(repo, [{ session: { ...s }, probeOutcome: "auth_failed" }]);
    expect(r.summary.applied).toBe(1);
    expect(r.summary.appliedIllegal).toBe(1);
    expect(r.summary.appliedLegal).toBe(0);
  });
});
