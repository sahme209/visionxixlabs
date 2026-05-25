import { describe, expect, it } from "vitest";
import { applyConnectorSetupEvent } from "../connectorSetupRepo";
import type {
  ConnectorSetupRepo,
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "../connectorSetupRepo";
import {
  attentionRank,
  buildOrgSetupSnapshot,
  isActionable,
  sidebarDotColorFor,
  type SnapshotRepo,
} from "../connectorSetupSnapshot";
import type { ConnectorSetupStatus } from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 415 — in-memory snapshot repo stub.

   Extends the Phase 414 stub with `findMany` so the snapshot service
   can pull every session for an org in one query. The injected `clock`
   lets us advance time between writes — that's how we exercise
   `minutesSinceTransition` and `daysConnected` deterministically.
   ────────────────────────────────────────────────────────────── */

interface Stub extends SnapshotRepo {
  _sessions: ConnectorSetupSessionRow[];
  _transitions: ConnectorSetupTransitionRow[];
  _advance(ms: number): void;
  _now(): Date;
}

function makeRepo(start = new Date(2026, 0, 1, 0, 0, 0)): Stub {
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
        const row: ConnectorSetupTransitionRow = {
          id: nextId(),
          createdAt: now(),
          ...data,
        };
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
    async $transaction(fn) { return fn(repo as ConnectorSetupRepo); },
  };
  return repo;
}

/* ──────────────────────────────────────────────────────────────────
   Pure derivation helpers — pin every status → (dot color, actionable,
   rank) mapping so a future kernel change can't silently shift UI tone.
   ────────────────────────────────────────────────────────────── */

describe("sidebarDotColorFor — every status maps to a stable color", () => {
  const cases: Array<[ConnectorSetupStatus, "green" | "amber" | "red" | "gray"]> = [
    ["connected",            "green"],
    ["needs_attention",      "amber"],
    ["setup_started",        "amber"],
    ["waiting_for_provider", "amber"],
    ["validating",           "amber"],
    ["failed",               "red"],
    ["disconnected",         "red"],
    ["revoked",              "red"],
    ["not_connected",        "gray"],
  ];
  it.each(cases)("%s → %s", (status, color) => {
    expect(sidebarDotColorFor(status)).toBe(color);
  });
});

describe("isActionable — covers every status the operator must look at", () => {
  it("is true for needs_attention + recoverable, false for everything else", () => {
    expect(isActionable("failed")).toBe(true);
    expect(isActionable("disconnected")).toBe(true);
    expect(isActionable("revoked")).toBe(true);
    expect(isActionable("needs_attention")).toBe(true);
    expect(isActionable("connected")).toBe(false);
    expect(isActionable("not_connected")).toBe(false);
    expect(isActionable("setup_started")).toBe(false);
    expect(isActionable("waiting_for_provider")).toBe(false);
    expect(isActionable("validating")).toBe(false);
  });
});

describe("attentionRank — strict ordering by urgency", () => {
  it("recoverable < needs_attention < in_flight < connected < not_connected", () => {
    expect(attentionRank("failed")).toBeLessThan(attentionRank("needs_attention"));
    expect(attentionRank("needs_attention")).toBeLessThan(attentionRank("setup_started"));
    expect(attentionRank("setup_started")).toBeLessThan(attentionRank("connected"));
    expect(attentionRank("connected")).toBeLessThan(attentionRank("not_connected"));
  });
});

/* ──────────────────────────────────────────────────────────────────
   Integration — buildOrgSetupSnapshot end-to-end.
   ────────────────────────────────────────────────────────────── */

describe("buildOrgSetupSnapshot — empty + populated org", () => {
  it("returns an empty snapshot for an org with no sessions", async () => {
    const repo = makeRepo();
    const snap = await buildOrgSetupSnapshot(repo, "org_empty");
    expect(snap.providers).toEqual([]);
    expect(snap.summary).toEqual({ total: 0, connected: 0, actionable: 0, inFlight: 0, notConnected: 0 });
  });

  it("sorts providers by attention need: recoverable → needs_attention → in_flight → connected", async () => {
    const repo = makeRepo();

    // gcp → connected (walk happy path)
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "gcp", event: ev, actor: { userId: "u" }, now: repo._now() });
    }

    // aws → failed (walk to validating, then fail)
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_failed" as const, errorCode: "AccessDenied" },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
    }

    // azure → setup_started (in_flight)
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "azure", event: { kind: "operator_started" }, actor: { userId: "u" }, now: repo._now() });

    // github → connected then regressed → needs_attention
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
      { kind: "health_check_regressed" as const },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "github", event: ev, actor: { systemLabel: "cron" }, now: repo._now() });
    }

    const snap = await buildOrgSetupSnapshot(repo, "o", { now: new Date(2026, 0, 1, 1, 0, 0) });
    expect(snap.providers.map((p) => p.provider)).toEqual(["aws", "github", "azure", "gcp"]);
    expect(snap.summary).toEqual({ total: 4, connected: 1, actionable: 2, inFlight: 1, notConnected: 0 });
    expect(snap.providers[0].status).toBe("failed");
    expect(snap.providers[0].lastErrorCode).toBe("AccessDenied");
    expect(snap.providers[0].actionable).toBe(true);
    expect(snap.providers[3].status).toBe("connected");
    expect(snap.providers[3].actionable).toBe(false);
  });
});

describe("buildOrgSetupSnapshot — derived time fields", () => {
  it("computes minutesSinceTransition + daysConnected from injected `now`", async () => {
    const repo = makeRepo(new Date(2026, 0, 1, 0, 0, 0));
    // Walk to connected at t=0.
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
    ]) {
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
    }
    // Advance 3 days + 17 minutes.
    const now = new Date(2026, 0, 4, 0, 17, 0);
    const snap = await buildOrgSetupSnapshot(repo, "o", { now });
    expect(snap.providers).toHaveLength(1);
    expect(snap.providers[0].daysConnected).toBe(3);
    expect(snap.providers[0].minutesSinceTransition).toBe(3 * 24 * 60 + 17);
  });

  it("daysConnected is null when firstConnectedAt is null (never reached connected)", async () => {
    const repo = makeRepo();
    await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: { kind: "operator_started" }, actor: { userId: "u" }, now: repo._now() });
    const snap = await buildOrgSetupSnapshot(repo, "o");
    expect(snap.providers[0].daysConnected).toBeNull();
  });
});

describe("buildOrgSetupSnapshot — recentTransitions inlining", () => {
  it("inlines up to N transitions newest-first with ageSeconds derived from now", async () => {
    const repo = makeRepo(new Date(2026, 0, 1, 0, 0, 0));
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_succeeded" as const },
      { kind: "health_check_regressed" as const },
      { kind: "health_check_recovered" as const },
    ]) {
      repo._advance(60_000);
      await applyConnectorSetupEvent(repo, { organizationId: "o", provider: "aws", event: ev, actor: { userId: "u" }, now: repo._now() });
    }
    const snap = await buildOrgSetupSnapshot(repo, "o", { now: new Date(2026, 0, 1, 0, 10, 0), recentTransitionsLimit: 3 });
    expect(snap.providers).toHaveLength(1);
    const tx = snap.providers[0].recentTransitions;
    expect(tx).toHaveLength(3);
    expect(tx[0].eventKind).toBe("health_check_recovered");
    expect(tx[1].eventKind).toBe("health_check_regressed");
    expect(tx[2].eventKind).toBe("validation_succeeded");
    // ageSeconds must be monotone non-decreasing (older transitions have larger age).
    expect(tx[0].ageSeconds).toBeLessThanOrEqual(tx[1].ageSeconds);
    expect(tx[1].ageSeconds).toBeLessThanOrEqual(tx[2].ageSeconds);
  });
});
