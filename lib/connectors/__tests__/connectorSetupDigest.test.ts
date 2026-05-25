import { describe, expect, it } from "vitest";
import { buildOrgSetupDigest } from "../connectorSetupDigest";
import { applyConnectorSetupEvent } from "../connectorSetupRepo";
import type {
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "../connectorSetupRepo";
import type { SnapshotRepo } from "../connectorSetupSnapshot";

/* ──────────────────────────────────────────────────────────────────
   Phase 420 — in-memory repo extending the Phase 415 stub. The
   digest needs SnapshotRepo (with findMany on sessions) and the
   full transition history lookup.
   ────────────────────────────────────────────────────────────── */

interface Stub extends SnapshotRepo {
  _sessions: ConnectorSetupSessionRow[];
  _transitions: ConnectorSetupTransitionRow[];
  _advance(ms: number): void;
  _now(): Date;
}

function makeRepo(start = new Date("2026-05-25T12:00:00Z")): Stub {
  const sessions: ConnectorSetupSessionRow[] = [];
  const transitions: ConnectorSetupTransitionRow[] = [];
  let clock = new Date(start);
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(clock);

  const repo: Stub = {
    _sessions: sessions,
    _transitions: transitions,
    _advance(ms) { clock = new Date(clock.getTime() + ms); },
    _now() { return new Date(clock); },

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

/* ──────────────────────────────────────────────────────────────────
   Tests.
   ────────────────────────────────────────────────────────────── */

describe("buildOrgSetupDigest — empty org", () => {
  it("empty org → providers:[] + summary zeros", async () => {
    const repo = makeRepo();
    const d = await buildOrgSetupDigest(repo, "o");
    expect(d.providers).toEqual([]);
    expect(d.summary.total).toBe(0);
    expect(d.summary.stickyErrorCount).toBe(0);
    expect(d.summary.chronicOscillationCount).toBe(0);
  });
});

describe("buildOrgSetupDigest — composes CTA from operator copy", () => {
  it("connected provider → 'Disconnect' CTA, secondary tone, errorClass:healthy", async () => {
    const repo = makeRepo();
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
    }
    const d = await buildOrgSetupDigest(repo, "o");
    expect(d.providers).toHaveLength(1);
    const p = d.providers[0];
    expect(p.status).toBe("connected");
    expect(p.suggested.ctaLabel).toBe("Disconnect");
    expect(p.suggested.tone).toBe("secondary");
    expect(p.errorClass.kind).toBe("healthy");
  });

  it("failed provider w/ AccessDenied → 'Start fresh setup' + hint about wait 30 seconds", async () => {
    const repo = makeRepo();
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_failed" as const, errorCode: "AccessDenied" },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
    }
    const d = await buildOrgSetupDigest(repo, "o");
    const p = d.providers[0];
    expect(p.suggested.ctaLabel).toBe("Start fresh setup");
    expect(p.suggested.hint).toMatch(/wait 30 seconds/i);
  });
});

describe("buildOrgSetupDigest — sticky error surfaces in errorClass", () => {
  it("3 consecutive AccessDenied failures → errorClass.kind === sticky_error", async () => {
    const repo = makeRepo();
    // First walk: operator_started → ... → validating → validation_failed
    for (let i = 0; i < 3; i++) {
      for (const ev of [
        { kind: "operator_started" as const },
        { kind: "provider_link_opened" as const },
        { kind: "bounce_back_received" as const },
        { kind: "validation_failed" as const, errorCode: "AccessDenied" },
      ]) {
        repo._advance(60_000);
        await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
      }
    }
    repo._advance(60_000);
    const d = await buildOrgSetupDigest(repo, "o", { now: repo._now() });
    const p = d.providers[0];
    expect(p.status).toBe("failed");
    expect(p.errorClass.kind).toBe("sticky_error");
    if (p.errorClass.kind !== "sticky_error") return;
    expect(p.errorClass.errorCode).toBe("AccessDenied");
    expect(p.errorClass.consecutiveCount).toBe(3);
    expect(d.summary.stickyErrorCount).toBe(1);
  });
});

describe("buildOrgSetupDigest — timeline renders humanized lines", () => {
  it("timeline contains 'Operator started setup' for the first transition", async () => {
    const repo = makeRepo();
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "operator_started" }, actor: { userId: "u" }, now: repo._now() });
    const d = await buildOrgSetupDigest(repo, "o");
    const p = d.providers[0];
    expect(p.timeline).toHaveLength(1);
    expect(p.timeline[0].text).toContain("Operator");
    expect(p.timeline[0].text).toContain("started setup");
    expect(p.timeline[0].isLegal).toBe(true);
  });

  it("timeline reflects sort: newest-first via Phase 415 snapshot", async () => {
    const repo = makeRepo();
    repo._advance(1000);
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "operator_started" }, actor: { userId: "u" }, now: repo._now() });
    repo._advance(1000);
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "provider_link_opened" }, actor: { userId: "u" }, now: repo._now() });
    repo._advance(1000);
    const d = await buildOrgSetupDigest(repo, "o", { now: repo._now() });
    const lines = d.providers[0].timeline;
    expect(lines[0].text).toContain("opened the provider");
    expect(lines[1].text).toContain("started setup");
    // ageSeconds must be monotone non-decreasing as we go further back.
    expect(lines[0].ageSeconds).toBeLessThanOrEqual(lines[1].ageSeconds);
  });
});

describe("buildOrgSetupDigest — summary aggregates across providers", () => {
  it("counts sticky + chronic across multiple providers", async () => {
    const repo = makeRepo();

    // aws → sticky_error path
    for (let i = 0; i < 3; i++) {
      for (const ev of [
        { kind: "operator_started" as const },
        { kind: "provider_link_opened" as const },
        { kind: "bounce_back_received" as const },
        { kind: "validation_failed" as const, errorCode: "AccessDenied" },
      ]) {
        repo._advance(60_000);
        await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
      }
    }

    // azure → connected, no failures (healthy)
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
    ]) {
      repo._advance(60_000);
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "azure", event: ev, actor: { userId: "u" }, now: repo._now() });
    }

    repo._advance(60_000);
    const d = await buildOrgSetupDigest(repo, "o", { now: repo._now() });
    expect(d.summary.total).toBe(2);
    expect(d.summary.stickyErrorCount).toBe(1);
    expect(d.summary.chronicOscillationCount).toBe(0);
    expect(d.summary.connected).toBe(1);
    expect(d.summary.actionable).toBe(1); // aws (failed)
  });
});
