/**
 * Operational memory model — typed records for the agent's long-term memory
 * of every operationally meaningful event in a tenant.
 *
 * Memory records are deliberately structured (not free-text). Each record
 * carries explainable evidence, outcome, and a typed impact delta. This is
 * the substrate the memory-aware reasoner reads from.
 *
 * No secrets, no credentials, no raw cloud data — only structured signals.
 */

import type { CloudProvider } from "@/lib/connectors/interface";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

// ---------------------------------------------------------------------------
// Memory record taxonomy
// ---------------------------------------------------------------------------

export type MemoryRecordKind =
  | "scan.completed"
  | "scan.failed"
  | "finding.observed"
  | "finding.recurring"
  | "recommendation.proposed"
  | "recommendation.accepted"
  | "recommendation.rejected"
  | "recommendation.deferred"
  | "execution.applied"
  | "execution.failed"
  | "approval.granted"
  | "approval.denied"
  | "approval.expired"
  | "rollback.executed"
  | "rollback.failed"
  | "verification.passed"
  | "verification.failed"
  | "drift.detected"
  | "drift.cleared"
  | "release.deployed"
  | "release.rolled_back"
  | "release.blocked"
  | "release.readiness_changed"
  | "desktop.handoff_delivered"
  | "desktop.local_execution"
  | "provider.health_changed"
  | "user.decision";

export type MemoryOutcome = "positive" | "negative" | "neutral" | "pending";

export interface MemoryImpact {
  /** Net cost delta in USD/month. Positive = savings, negative = cost added. */
  costDeltaUsd?: number;
  /** Confidence delta in [-1, 1]. */
  confidenceDelta?: number;
  /** Risk delta — qualitative. */
  riskDelta?: "decreased" | "increased" | "unchanged";
}

/** A single memory record. Persistable, replayable, explainable. */
export interface MemoryRecord {
  id: string;
  /** Tenant scope — required for isolation. */
  organizationId: string;
  /** User who triggered the event, or "system" for agent-initiated. */
  actorId: string;
  /** What kind of event this is. */
  kind: MemoryRecordKind;
  /** Provider this event relates to. */
  provider?: CloudProvider;
  /** Resources this event references. */
  resources: ResourceRef[];
  /** Short human-readable summary. */
  summary: string;
  /** Structured evidence — names of signals that drove this event. */
  evidence: { name: string; value: string | number | boolean }[];
  /** Outcome — positive (saving locked), negative (rollback), neutral, pending. */
  outcome: MemoryOutcome;
  /** Typed impact attached to the outcome. */
  impact: MemoryImpact;
  /** Cross-links to other records. */
  links: {
    auditEventIds?: string[];
    executionPlanIds?: string[];
    recommendationIds?: string[];
    findingIds?: string[];
  };
  /** Suggested next action — surfaces in command center. */
  nextAction?: { label: string; href: string };
  /** When this event occurred. */
  occurredAt: string;
  /** When the memory record was written. */
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface MemoryQuery {
  organizationId: string;
  kinds?: MemoryRecordKind[];
  provider?: CloudProvider;
  resourceIds?: string[];
  sinceISO?: string;
  outcome?: MemoryOutcome;
  limit?: number;
}

export interface MemoryStore {
  insert(record: MemoryRecord): Promise<void>;
  query(opts: MemoryQuery): Promise<MemoryRecord[]>;
  /** Find recurring patterns of a given kind for a given resource. */
  recurringForResource(opts: { organizationId: string; resourceId: string; kind: MemoryRecordKind }): Promise<number>;
  /** Confidence delta for an action class over the last N days. */
  confidenceTrend(opts: { organizationId: string; resourceKind: string; days: number }): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory implementation (for tests + preview/demo paths)
//
// Production wiring slots a Prisma-backed implementation in place of this.
// ---------------------------------------------------------------------------

export function createInMemoryStore(seed: MemoryRecord[] = []): MemoryStore {
  const store: MemoryRecord[] = [...seed];

  return {
    async insert(record) {
      store.push(record);
    },
    async query(opts) {
      let out = store.filter((r) => r.organizationId === opts.organizationId);
      if (opts.kinds && opts.kinds.length > 0) out = out.filter((r) => opts.kinds!.includes(r.kind));
      if (opts.provider) out = out.filter((r) => r.provider === opts.provider);
      if (opts.resourceIds && opts.resourceIds.length > 0) {
        const set = new Set(opts.resourceIds);
        out = out.filter((r) => r.resources.some((res) => set.has(res.id)));
      }
      if (opts.sinceISO) out = out.filter((r) => r.occurredAt >= opts.sinceISO!);
      if (opts.outcome) out = out.filter((r) => r.outcome === opts.outcome);
      out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      if (opts.limit) out = out.slice(0, opts.limit);
      return out;
    },
    async recurringForResource({ organizationId, resourceId, kind }) {
      return store.filter((r) =>
        r.organizationId === organizationId &&
        r.kind === kind &&
        r.resources.some((res) => res.id === resourceId)
      ).length;
    },
    async confidenceTrend({ organizationId, resourceKind, days }) {
      const since = Date.now() - days * 86_400_000;
      const records = store.filter((r) =>
        r.organizationId === organizationId &&
        new Date(r.occurredAt).getTime() >= since &&
        r.resources.some((res) => res.id.includes(resourceKind))
      );
      const sum = records.reduce((s, r) => s + (r.impact.confidenceDelta ?? 0), 0);
      return records.length === 0 ? 0 : sum / records.length;
    },
  };
}

// ---------------------------------------------------------------------------
// Record builders — make it impossible to write malformed memory
// ---------------------------------------------------------------------------

interface BuildOptions {
  organizationId: string;
  actorId?: string;
  provider?: CloudProvider;
  resources?: ResourceRef[];
  evidence?: { name: string; value: string | number | boolean }[];
  impact?: MemoryImpact;
  links?: MemoryRecord["links"];
  nextAction?: MemoryRecord["nextAction"];
  occurredAt?: string;
}

export function buildMemoryRecord(kind: MemoryRecordKind, summary: string, outcome: MemoryOutcome, opts: BuildOptions): MemoryRecord {
  const now = new Date().toISOString();
  return {
    id: `mem_${kind.replace(/\./g, "_")}_${Date.now().toString(36)}`,
    organizationId: opts.organizationId,
    actorId: opts.actorId ?? "system",
    kind,
    provider: opts.provider,
    resources: opts.resources ?? [],
    summary,
    evidence: opts.evidence ?? [],
    outcome,
    impact: opts.impact ?? {},
    links: opts.links ?? {},
    nextAction: opts.nextAction,
    occurredAt: opts.occurredAt ?? now,
    recordedAt: now,
  };
}
