/**
 * Phase 506 — AdvisorInputs aggregator.
 *
 * Pure read-side: gathers every signal the advisor engine needs from
 * the existing ReleaseOps tables and returns a single AdvisorInputs.
 * The aggregator itself does no business logic — it's just plumbing
 * so the route handler stays slim.
 *
 * The aggregator is liberal with missing tables (Phase 466/485/495/
 * 499/501/etc migrations may not all be applied yet) — every count
 * call is wrapped in safe-count so the advisor can still run on a
 * partially-migrated DB and degrade gracefully.
 */

import { isMissingTable } from "./releaseListResponder";
import type { AdvisorInputs } from "./releaseAdvisorEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract — wide because the advisor sees a lot.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseSnapshotRow {
  id: string;
  organizationId: string;
  applicationId: string;
  status: string;
  releaseTag: string | null;
  commitSha: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  createdAt: Date;
}

export interface ReadinessSnapshotRow {
  overallScore: number;
  riskLevel: string;
  blockersJson: unknown;
  branchGovernance: number;
  changeCompliance: number;
  secretTraceability: number;
  rollbackReadiness: number;
  manualReconciliation: number;
}

export interface BranchProtectionSummaryRow {
  strength: string;
  allowsForcePushes: boolean;
  branchName: string;
}

export interface AdvisorInputsRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<ReleaseSnapshotRow | null>;
    findFirst(args: {
      where: { organizationId: string; applicationId: string; status?: { in: string[] } };
      orderBy: { createdAt: "desc" };
    }): Promise<ReleaseSnapshotRow | null>;
  };
  releaseReadinessSnapshot: {
    findFirst(args: {
      where: { organizationId: string; releaseId: string };
      orderBy: { evaluatedAt: "desc" };
    }): Promise<ReadinessSnapshotRow | null>;
  };
  policyViolation: {
    count(args: { where: { organizationId: string; releaseId: string; severity?: string; status?: string } }): Promise<number>;
  };
  manualFix: {
    count(args: { where: { organizationId: string; status?: string; environmentTier?: string } }): Promise<number>;
  };
  deploymentIncident: {
    count(args: { where: { organizationId: string; status?: string; severity?: string } }): Promise<number>;
  };
  branchProtectionSnapshot: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { branchName: "asc" };
    }): Promise<BranchProtectionSummaryRow[]>;
  };
  releaseEvidencePack: {
    findFirst(args: { where: { organizationId: string; releaseId: string } }): Promise<{ id: string } | null>;
  };
  releaseFreezeSession?: {
    findFirst(args: { where: { organizationId: string; status: "active" } }): Promise<{ id: string } | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Aggregation.
   ────────────────────────────────────────────────────────────── */

export type AggregateError =
  | "release_not_found"
  | "cross_org_release";

export interface AggregateOk {
  ok: true;
  inputs: AdvisorInputs;
}
export interface AggregateErr {
  ok: false;
  error: AggregateError;
  hint?: string;
}

export async function aggregateAdvisorInputs(
  repo: AdvisorInputsRepo,
  input: { organizationId: string; releaseId: string },
  opts: { now?: Date } = {},
): Promise<AggregateOk | AggregateErr> {
  const now = opts.now ?? new Date();

  const release = await repo.release.findUnique({ where: { id: input.releaseId } });
  if (!release) return { ok: false, error: "release_not_found" };
  if (release.organizationId !== input.organizationId) {
    return { ok: false, error: "cross_org_release" };
  }

  const readinessRow = await safe(() =>
    repo.releaseReadinessSnapshot.findFirst({
      where: { organizationId: input.organizationId, releaseId: release.id },
      orderBy: { evaluatedAt: "desc" },
    }),
    null,
  );

  const readinessInput = readinessRow ? {
    overallScore: readinessRow.overallScore,
    riskLevel: readinessRow.riskLevel,
    blockerCount: Array.isArray(readinessRow.blockersJson) ? readinessRow.blockersJson.length : 0,
    branchGovernance: readinessRow.branchGovernance,
    changeCompliance: readinessRow.changeCompliance,
    secretTraceability: readinessRow.secretTraceability,
    rollbackReadiness: readinessRow.rollbackReadiness,
    manualReconciliation: readinessRow.manualReconciliation,
  } : null;

  const [blocking, warning, advisory] = await Promise.all([
    safeCount(() => repo.policyViolation.count({ where: { organizationId: input.organizationId, releaseId: release.id, severity: "blocking", status: "open" } })),
    safeCount(() => repo.policyViolation.count({ where: { organizationId: input.organizationId, releaseId: release.id, severity: "warning", status: "open" } })),
    safeCount(() => repo.policyViolation.count({ where: { organizationId: input.organizationId, releaseId: release.id, severity: "advisory", status: "open" } })),
  ]);

  const [pendingTotal, pendingProd] = await Promise.all([
    safeCount(() => repo.manualFix.count({ where: { organizationId: input.organizationId, status: "pending" } })),
    safeCount(() => repo.manualFix.count({ where: { organizationId: input.organizationId, status: "pending", environmentTier: "prod" } })),
  ]);

  const [openIncidents, openCritical, mitigated] = await Promise.all([
    safeCount(() => repo.deploymentIncident.count({ where: { organizationId: input.organizationId, status: "open" } })),
    safeCount(() => repo.deploymentIncident.count({ where: { organizationId: input.organizationId, status: "open", severity: "critical" } })),
    safeCount(() => repo.deploymentIncident.count({ where: { organizationId: input.organizationId, status: "mitigated" } })),
  ]);

  const protectionRows = await safe(() =>
    repo.branchProtectionSnapshot.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { branchName: "asc" },
    }),
    [] as BranchProtectionSummaryRow[],
  );

  const snapshotsTotal = protectionRows.length;
  const weakOrNone = protectionRows.filter((p) => p.strength === "weak" || p.strength === "none").length;
  const forcePushAllowedOnMain = protectionRows.some((p) => p.branchName === "main" && p.allowsForcePushes);

  const evidence = await safe(() =>
    repo.releaseEvidencePack.findFirst({ where: { organizationId: input.organizationId, releaseId: release.id } }),
    null,
  );

  const previous = await safe(() =>
    repo.release.findFirst({
      where: {
        organizationId: input.organizationId,
        applicationId: release.applicationId,
        status: { in: ["deployed", "rolled_back", "failed"] },
      },
      orderBy: { createdAt: "desc" },
    }),
    null,
  );
  // Filter out self — the previous release is the one BEFORE this.
  const previousReleaseStatus = previous && previous.id !== release.id ? previous.status : null;

  const freeze = repo.releaseFreezeSession
    ? await safe(() => repo.releaseFreezeSession!.findFirst({ where: { organizationId: input.organizationId, status: "active" } }), null)
    : null;

  const inputs: AdvisorInputs = {
    release: {
      id: release.id,
      status: release.status,
      releaseTag: release.releaseTag,
      commitSha: release.commitSha,
      plannedWindowStart: release.plannedWindowStart,
      plannedWindowEnd: release.plannedWindowEnd,
    },
    readiness: readinessInput,
    policyViolations: { blocking, warning, advisory },
    pendingManualFixes: { total: pendingTotal, inProd: pendingProd },
    recentIncidents: { open: openIncidents, openCritical, mitigated },
    branchProtection: { snapshotsTotal, weakOrNone, forcePushAllowedOnMain },
    previousReleaseStatus,
    hasEvidencePack: evidence !== null,
    isInPlannedFreeze: freeze !== null,
    now,
  };

  return { ok: true, inputs };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return fallback; throw err; }
}

async function safeCount(fn: () => Promise<number>): Promise<number> {
  return safe(fn, 0);
}
