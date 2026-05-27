/**
 * Phase 481 — readiness inbox responder.
 *
 * Returns the latest ReleaseReadinessSnapshot per release for the
 * caller's org. The list is the at-a-glance "where is every release
 * sitting?" view — read-only; the Phase 480 evaluator is the write
 * path.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union risk level.
   ────────────────────────────────────────────────────────────── */

export const ALL_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof ALL_RISK_LEVELS)[number];

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ReadinessReleaseRow {
  id: string;
  organizationId: string;
  applicationId: string;
  releaseTag: string | null;
  status: string;
}

export interface ReadinessSnapshotRow {
  id: string;
  releaseId: string;
  overallScore: number;
  riskLevel: string;
  branchGovernance: number;
  changeCompliance: number;
  artifactTraceability: number;
  rollbackReadiness: number;
  driftRisk: number;
  manualReconciliation: number;
  blockersJson: unknown;
  evaluatedAt: Date;
  evaluationSource: string;
}

export interface ReadinessListRepo {
  release: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { createdAt: "desc" };
    }): Promise<ReadinessReleaseRow[]>;
  };
  releaseReadinessSnapshot: {
    findFirst(args: {
      where: { releaseId: string };
      orderBy: { evaluatedAt: "desc" };
    }): Promise<ReadinessSnapshotRow | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface ReadinessListRow {
  releaseId: string;
  applicationId: string;
  releaseTag: string | null;
  status: string;
  hasSnapshot: boolean;
  overallScore: number | null;
  riskLevel: RiskLevel | "unknown" | null;
  evaluatedAtIso: string | null;
  blockerCount: number;
  topBlockerMessage: string | null;
}

export type ReadinessListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        releases: ReadinessListRow[];
        summary: {
          total: number;
          evaluated: number;
          byRisk: Record<RiskLevel | "unknown", number>;
          averageScore: number | null;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ReadinessListBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReadinessListResponse(
  repo: ReadinessListRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const releases = await repo.release.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });

    const rows: ReadinessListRow[] = await Promise.all(
      releases.map(async (rel) => {
        const snap = await repo.releaseReadinessSnapshot.findFirst({
          where: { releaseId: rel.id },
          orderBy: { evaluatedAt: "desc" },
        });
        if (!snap) {
          return {
            releaseId: rel.id,
            applicationId: rel.applicationId,
            releaseTag: rel.releaseTag,
            status: rel.status,
            hasSnapshot: false,
            overallScore: null,
            riskLevel: null,
            evaluatedAtIso: null,
            blockerCount: 0,
            topBlockerMessage: null,
          };
        }
        const blockers = Array.isArray(snap.blockersJson) ? snap.blockersJson : [];
        const topBlocker = blockers[0] as { message?: string } | undefined;
        return {
          releaseId: rel.id,
          applicationId: rel.applicationId,
          releaseTag: rel.releaseTag,
          status: rel.status,
          hasSnapshot: true,
          overallScore: snap.overallScore,
          riskLevel: narrowRiskLevel(snap.riskLevel),
          evaluatedAtIso: snap.evaluatedAt.toISOString(),
          blockerCount: blockers.length,
          topBlockerMessage: topBlocker?.message ?? null,
        };
      }),
    );

    const byRisk: Record<RiskLevel | "unknown", number> = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 };
    let scoreSum = 0;
    let evaluated = 0;
    for (const r of rows) {
      if (r.hasSnapshot && r.overallScore !== null && r.riskLevel) {
        byRisk[r.riskLevel] += 1;
        scoreSum += r.overallScore;
        evaluated += 1;
      }
    }
    const averageScore = evaluated > 0 ? Math.round(scoreSum / evaluated) : null;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          releases: rows,
          summary: { total: rows.length, evaluated, byRisk, averageScore },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 migrations required for readiness inbox." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function narrowRiskLevel(s: string): RiskLevel | "unknown" {
  return (ALL_RISK_LEVELS as readonly string[]).includes(s) ? (s as RiskLevel) : "unknown";
}
