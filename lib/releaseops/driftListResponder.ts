/**
 * Phase 485 — drift finding inbox responder.
 *
 * Read-only list of DriftFinding rows for the caller's org. The
 * detector (Phase 485 driftDetector.ts) is the write path — wired
 * in via a follow-on phase that connects the IaC + cloud providers.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  ALL_DRIFT_SEVERITIES,
  ALL_RESOURCE_KINDS,
  type DriftSeverity,
  type ResourceKind,
} from "./driftDetector";

/* ──────────────────────────────────────────────────────────────────
   Closed-union status.
   ────────────────────────────────────────────────────────────── */

export const ALL_DRIFT_STATUSES = ["open", "acknowledged", "suppressed", "resolved"] as const;
export type DriftStatus = (typeof ALL_DRIFT_STATUSES)[number];

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface DriftRow {
  id: string;
  organizationId: string;
  resourceKind: string;
  resourceId: string;
  displayName: string;
  applicationId: string | null;
  environmentTier: string | null;
  severity: string;
  status: string;
  summary: string;
  remediationKey: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  detectedAt: Date;
  lastSeenAt: Date;
}

export interface DriftListRepo {
  driftFinding: {
    findMany(args: {
      where: {
        organizationId: string;
        status?: { in: DriftStatus[] };
        severity?: { in: DriftSeverity[] };
      };
      orderBy: { detectedAt: "desc" };
      take?: number;
    }): Promise<DriftRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface DriftListRow {
  id: string;
  resourceKind: ResourceKind | "unknown";
  resourceId: string;
  displayName: string;
  applicationId: string | null;
  environmentTier: string | null;
  severity: DriftSeverity | "unknown";
  status: DriftStatus | "unknown";
  summary: string;
  remediationKey: string | null;
  decidedByUserId: string | null;
  decidedAtIso: string | null;
  decisionReason: string | null;
  detectedAtIso: string;
  lastSeenAtIso: string;
}

export type DriftListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        findings: DriftListRow[];
        summary: {
          total: number;
          byStatus: Record<DriftStatus | "unknown", number>;
          bySeverity: Record<DriftSeverity | "unknown", number>;
          openCritical: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: DriftListBody }

export interface BuildDriftListOptions {
  now?: Date;
  correlationId?: string;
  statusFilter?: ReadonlyArray<DriftStatus>;
  severityFilter?: ReadonlyArray<DriftSeverity>;
  take?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildDriftListResponse(
  repo: DriftListRepo,
  organizationId: string,
  opts: BuildDriftListOptions = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const where: {
      organizationId: string;
      status?: { in: DriftStatus[] };
      severity?: { in: DriftSeverity[] };
    } = { organizationId };
    if (opts.statusFilter && opts.statusFilter.length > 0) {
      where.status = { in: Array.from(opts.statusFilter) };
    }
    if (opts.severityFilter && opts.severityFilter.length > 0) {
      where.severity = { in: Array.from(opts.severityFilter) };
    }
    const rows = await repo.driftFinding.findMany({
      where,
      orderBy: { detectedAt: "desc" },
      ...(opts.take ? { take: opts.take } : {}),
    });

    const findings: DriftListRow[] = rows.map((r) => ({
      id: r.id,
      resourceKind: narrowResourceKind(r.resourceKind),
      resourceId: r.resourceId,
      displayName: r.displayName,
      applicationId: r.applicationId,
      environmentTier: r.environmentTier,
      severity: narrowSeverity(r.severity),
      status: narrowStatus(r.status),
      summary: r.summary,
      remediationKey: r.remediationKey,
      decidedByUserId: r.decidedByUserId,
      decidedAtIso: r.decidedAt ? r.decidedAt.toISOString() : null,
      decisionReason: r.decisionReason,
      detectedAtIso: r.detectedAt.toISOString(),
      lastSeenAtIso: r.lastSeenAt.toISOString(),
    }));

    const byStatus: Record<DriftStatus | "unknown", number> = {
      open: 0, acknowledged: 0, suppressed: 0, resolved: 0, unknown: 0,
    };
    const bySeverity: Record<DriftSeverity | "unknown", number> = {
      low: 0, medium: 0, high: 0, critical: 0, unknown: 0,
    };
    let openCritical = 0;
    for (const f of findings) {
      byStatus[f.status] += 1;
      bySeverity[f.severity] += 1;
      if (f.status === "open" && f.severity === "critical") openCritical += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          findings,
          summary: { total: findings.length, byStatus, bySeverity, openCritical },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "DriftFinding table needs a migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function narrowStatus(s: string): DriftStatus | "unknown" {
  return (ALL_DRIFT_STATUSES as readonly string[]).includes(s) ? (s as DriftStatus) : "unknown";
}
function narrowSeverity(s: string): DriftSeverity | "unknown" {
  return (ALL_DRIFT_SEVERITIES as readonly string[]).includes(s) ? (s as DriftSeverity) : "unknown";
}
function narrowResourceKind(s: string): ResourceKind | "unknown" {
  return (ALL_RESOURCE_KINDS as readonly string[]).includes(s) ? (s as ResourceKind) : "unknown";
}
