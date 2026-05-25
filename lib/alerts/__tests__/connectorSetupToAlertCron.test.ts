import { describe, expect, it } from "vitest";
import {
  signalRefFor,
  tickConnectorSetupToAlertEscalation,
  type ConnectorListRepo,
} from "../connectorSetupToAlertCron";
import { applyConnectorSetupEvent } from "@/lib/connectors/connectorSetupRepo";
import type {
  ConnectorSetupSessionRow,
  ConnectorSetupTransitionRow,
} from "@/lib/connectors/connectorSetupRepo";
import { applyAlertEscalationEvent } from "../alertEscalationRepo";
import type {
  AlertEscalationRepo,
  AlertEscalationSessionRow,
  AlertEscalationTransitionRow,
} from "../alertEscalationRepo";

/* ──────────────────────────────────────────────────────────────────
   Two parallel in-memory stubs — one for connectors, one for alerts.
   Same shape and identity contracts as the prior phases' stubs.
   ────────────────────────────────────────────────────────────── */

interface ConnectorStub extends ConnectorListRepo {
  _sessions: ConnectorSetupSessionRow[];
  _transitions: ConnectorSetupTransitionRow[];
  _now(): Date;
  _advance(ms: number): void;
}

interface AlertStub extends AlertEscalationRepo {
  _sessions: AlertEscalationSessionRow[];
  _transitions: AlertEscalationTransitionRow[];
}

function makeConnectorRepo(start = new Date("2026-05-25T12:00:00Z")): ConnectorStub {
  const sessions: ConnectorSetupSessionRow[] = [];
  const transitions: ConnectorSetupTransitionRow[] = [];
  let clock = new Date(start);
  let counter = 0;
  const nextId = () => `c_${(counter += 1)}`;

  const repo: ConnectorStub = {
    _sessions: sessions,
    _transitions: transitions,
    _now() { return new Date(clock); },
    _advance(ms) { clock = new Date(clock.getTime() + ms); },
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
          organizationId: data.organizationId, provider: data.provider,
          status: "not_connected", lastEventKind: null, lastErrorCode: null,
          firstConnectedAt: null, lastTransitionAt: new Date(clock),
          createdAt: new Date(clock), updatedAt: new Date(clock),
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
    connectorSetupTransition: {
      async create({ data }) {
        const row: ConnectorSetupTransitionRow = { id: nextId(), createdAt: new Date(clock), ...data };
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

function makeAlertRepo(): AlertStub {
  const sessions: AlertEscalationSessionRow[] = [];
  const transitions: AlertEscalationTransitionRow[] = [];
  let counter = 0;
  const nextId = () => `a_${(counter += 1)}`;
  const now = () => new Date(2026, 0, 1, 0, 0, counter);

  const repo: AlertStub = {
    _sessions: sessions, _transitions: transitions,
    alertEscalationSession: {
      async findUnique({ where }) {
        const { organizationId, signalRef } = where.organizationId_signalRef;
        const row = sessions.find((s) => s.organizationId === organizationId && s.signalRef === signalRef);
        return row ? { ...row } : null;
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

/* ──────────────────────────────────────────────────────────────────
   Helpers.
   ────────────────────────────────────────────────────────────── */

async function walkConnectorToSticky(connectorRepo: ConnectorStub, provider: string, errorCode = "AccessDenied") {
  // Three full retry cycles each ending in validation_failed with the same errorCode.
  for (let i = 0; i < 3; i++) {
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_failed" as const, errorCode },
    ]) {
      connectorRepo._advance(60_000);
      await applyConnectorSetupEvent(connectorRepo, {
        organizationId: "o", provider, event: ev, actor: { userId: "u" }, now: connectorRepo._now(),
      });
    }
  }
}

async function walkConnectorToHealthy(connectorRepo: ConnectorStub, provider: string) {
  for (const ev of [
    { kind: "operator_started" as const },
    { kind: "provider_link_opened" as const },
    { kind: "bounce_back_received" as const },
    { kind: "validation_succeeded" as const },
  ]) {
    connectorRepo._advance(60_000);
    await applyConnectorSetupEvent(connectorRepo, {
      organizationId: "o", provider, event: ev, actor: { userId: "u" }, now: connectorRepo._now(),
    });
  }
}

/* ──────────────────────────────────────────────────────────────────
   Tests.
   ────────────────────────────────────────────────────────────── */

describe("signalRefFor — canonical naming", () => {
  it("composes provider + organizationId deterministically", () => {
    expect(signalRefFor("org_42", "aws")).toBe("connector_setup:aws:org_42");
  });
});

describe("tick — empty org", () => {
  it("returns empty result + zeroed summary", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o");
    expect(r.perSession).toEqual([]);
    expect(r.summary).toEqual({ inspected: 0, fired: 0, cleared: 0, noop: 0, errored: 0 });
  });
});

describe("tick — healthy connectors → no alerts fired", () => {
  it("connected with no failures → noop, no alert rows written", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToHealthy(cr, "aws");
    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    expect(r.summary.fired).toBe(0);
    expect(r.summary.noop).toBe(1);
    expect(ar._sessions).toHaveLength(0);
  });
});

describe("tick — sticky error → fires alert end-to-end", () => {
  it("AWS sticky AccessDenied → alert session created in `fired` with right signalRef", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    cr._advance(60_000);
    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });

    expect(r.summary.fired).toBe(1);
    expect(r.summary.inspected).toBe(1);
    expect(ar._sessions).toHaveLength(1);
    const alertRow = ar._sessions[0];
    expect(alertRow.status).toBe("fired");
    expect(alertRow.signalRef).toBe("connector_setup:aws:o");
    expect(alertRow.firstFiredAt).not.toBeNull();
    expect(ar._transitions[0].actorLabel).toBe("bridge:sticky-error");
  });
});

describe("tick — open alert suppresses re-fire", () => {
  it("running the tick twice on a sticky connector creates only one alert + one fire transition", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    cr._advance(60_000);

    await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    cr._advance(60_000);
    const r2 = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });

    expect(ar._sessions).toHaveLength(1);
    expect(ar._sessions[0].status).toBe("fired");
    // Second tick should have noop'd with reason already_open.
    expect(r2.summary.noop).toBe(1);
    expect(r2.summary.fired).toBe(0);
    expect(ar._transitions).toHaveLength(1);
  });
});

describe("tick — healthy after sticky → signal_cleared (auto_resolved)", () => {
  it("flips an open alert to auto_resolved when the connector recovers", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    cr._advance(60_000);
    await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    expect(ar._sessions[0].status).toBe("fired");

    // Operator recovers the connector — operator_started → ... →
    // validation_succeeded — but the sticky-error classifier uses a
    // 24h window by default, so the prior failures will still be in
    // window. Use last_event_was_recovery short-circuit instead.
    await walkConnectorToHealthy(cr, "aws");
    cr._advance(60_000);
    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });

    expect(r.summary.cleared).toBe(1);
    expect(ar._sessions[0].status).toBe("auto_resolved");
  });
});

describe("tick — multi-provider org", () => {
  it("tallies fire / noop / cleared correctly across providers in one tick", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    await walkConnectorToHealthy(cr, "azure");
    // gcp transient — only one validation_failed, won't be sticky.
    for (const ev of [
      { kind: "operator_started" as const },
      { kind: "provider_link_opened" as const },
      { kind: "bounce_back_received" as const },
      { kind: "validation_failed" as const, errorCode: "AccessDenied" },
    ]) {
      cr._advance(60_000);
      await applyConnectorSetupEvent(cr, { organizationId: "o", provider: "gcp", event: ev, actor: { userId: "u" }, now: cr._now() });
    }
    cr._advance(60_000);

    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    expect(r.summary.inspected).toBe(3);
    expect(r.summary.fired).toBe(1);
    expect(r.summary.noop).toBe(2);
  });
});

describe("tick — error containment", () => {
  it("a throw on one session does not abort the batch", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    await walkConnectorToSticky(cr, "azure", "AccessDenied");
    cr._advance(60_000);

    // Force findUnique on alerts to throw for AWS but not for azure.
    const originalFindUnique = ar.alertEscalationSession.findUnique.bind(ar.alertEscalationSession);
    ar.alertEscalationSession.findUnique = async (args) => {
      if (args.where.organizationId_signalRef.signalRef === "connector_setup:aws:o") {
        throw new Error("DB blip");
      }
      return originalFindUnique(args);
    };

    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    expect(r.summary.inspected).toBe(2);
    expect(r.summary.errored).toBe(1);
    expect(r.summary.fired).toBe(1); // azure still fires
    const errors = r.perSession.filter((o) => o.kind === "errored");
    expect(errors[0]).toMatchObject({ provider: "aws", error: "DB blip" });
  });
});

describe("tick — actor label propagates to alert audit row", () => {
  it("opts.actorLabel overrides the default", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    cr._advance(60_000);
    await tickConnectorSetupToAlertEscalation(cr, ar, "o", {
      now: cr._now(),
      actorLabel: "cron:hourly-sticky-scan",
    });
    expect(ar._transitions[0].actorLabel).toBe("cron:hourly-sticky-scan");
  });
});

describe("tick — composes with manual alert events", () => {
  it("if operator acknowledged the alert, next tick produces noop (already_open)", async () => {
    const cr = makeConnectorRepo(); const ar = makeAlertRepo();
    await walkConnectorToSticky(cr, "aws", "AccessDenied");
    cr._advance(60_000);
    await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    expect(ar._sessions[0].status).toBe("fired");

    // Operator acknowledges via the real repo.
    await applyAlertEscalationEvent(ar, {
      organizationId: "o", signalRef: "connector_setup:aws:o",
      event: { kind: "operator_acknowledged", operatorUserId: "u" },
      actor: { userId: "u" },
    });
    expect(ar._sessions[0].status).toBe("acknowledged");

    cr._advance(60_000);
    const r = await tickConnectorSetupToAlertEscalation(cr, ar, "o", { now: cr._now() });
    expect(r.summary.noop).toBe(1);
    expect(r.summary.fired).toBe(0);
    expect(ar._sessions[0].status).toBe("acknowledged");
  });
});
