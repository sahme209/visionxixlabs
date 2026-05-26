/**
 * Phase 442 — Release / ReleaseReadinessSnapshot / ReleaseEvidencePack
 * persistence layer.
 *
 * Same DI-Prisma-client pattern Phases 414 + 427 used: a structural
 * `ReleaseRepo` interface, tests pass an in-memory stub, the route
 * handler passes the real PrismaClient. No transitive imports of the
 * generated client at module-load time, so the broken jws/gaxios
 * baseline can't crash the test environment.
 *
 * Closed-union of statuses + transitions is application-layer for now
 * (the Release-state-machine kernel is a focused future phase). This
 * module just enforces the legal-transition table when status changes.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed-union of legal Release statuses + transition table.
   ────────────────────────────────────────────────────────────── */

export const ALL_RELEASE_STATUSES = [
  "draft",         // operator is still defining scope
  "ready",         // scope frozen, awaiting deploy window
  "deploying",     // deploy in flight
  "deployed",      // deploy completed successfully
  "rolled_back",   // deployed but rolled back to rollback reference
  "failed",        // deploy failed before completion
] as const;

export type ReleaseStatus = (typeof ALL_RELEASE_STATUSES)[number];

/**
 * Legal next statuses from each current status. Tracks the same
 * closed-union-with-explicit-illegal-returns pattern Phase 413's
 * connectorSetupSession.ts uses, just lighter-weight (no event
 * vocabulary yet — that lands when the state-machine kernel does).
 */
const NEXT_LEGAL: Record<ReleaseStatus, ReadonlyArray<ReleaseStatus>> = {
  draft:       ["ready"],
  ready:       ["draft", "deploying"],       // un-freeze allowed before deploy starts
  deploying:   ["deployed", "failed"],
  deployed:    ["rolled_back"],
  rolled_back: [],                            // terminal
  failed:      ["draft", "ready"],            // operator may re-scope and retry
};

export function isLegalReleaseTransition(from: ReleaseStatus, to: ReleaseStatus): boolean {
  return NEXT_LEGAL[from].includes(to);
}

/* ──────────────────────────────────────────────────────────────────
   Row types — narrow projection of the Prisma models.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseRow {
  id: string;
  organizationId: string;
  applicationId: string;
  targetEnvironmentId: string | null;
  releaseTag: string | null;
  commitSha: string | null;
  status: ReleaseStatus;
  scopeFinalizedAt: Date | null;
  scopeFinalizedByUserId: string | null;
  rollbackReferenceReleaseId: string | null;
  plannedWindowStart: Date | null;
  plannedWindowEnd: Date | null;
  actualDeployStart: Date | null;
  actualDeployEnd: Date | null;
  summary: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  updatedAt: Date;
}

export interface ReleaseReadinessSnapshotRow {
  id: string;
  organizationId: string;
  releaseId: string;
  evaluatedAt: Date;
  branchGovernance: number;
  changeCompliance: number;
  artifactTraceability: number;
  secretTraceability: number;
  rollbackReadiness: number;
  communicationReadiness: number;
  driftRisk: number;
  manualReconciliation: number;
  overallScore: number;
  riskLevel: ReadinessRiskLevel;
  blockersJson: ReadonlyArray<ReleaseBlocker>;
  evaluationSource: string;
}

export type ReadinessRiskLevel = "low" | "medium" | "high" | "critical";

export interface ReleaseBlocker {
  id: string;
  category: ReadinessDimension;
  severity: ReadinessRiskLevel;
  message: string;
  remediation?: string;
}

export type ReadinessDimension =
  | "branch_governance"
  | "change_compliance"
  | "artifact_traceability"
  | "secret_traceability"
  | "rollback_readiness"
  | "communication_readiness"
  | "drift_risk"
  | "manual_reconciliation";

export interface ReleaseEvidencePackRow {
  id: string;
  organizationId: string;
  releaseId: string;
  generatedAt: Date;
  signedAt: Date | null;
  contentHash: string | null;
  contentJson: Record<string, unknown>;
  exportRefsJson: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Structural Prisma repo contract.
   ────────────────────────────────────────────────────────────── */

interface ReleaseDelegate {
  findUnique(args: { where: { id: string } }): Promise<ReleaseRow | null>;
  findFirst(args: {
    where: {
      organizationId: string;
      applicationId: string;
      releaseTag: string;
    };
  }): Promise<ReleaseRow | null>;
  findMany(args: {
    where: { organizationId: string; applicationId?: string; status?: ReleaseStatus };
    orderBy: { createdAt: "desc" };
    take?: number;
  }): Promise<ReleaseRow[]>;
  create(args: {
    data: Pick<
      ReleaseRow,
      "organizationId" | "applicationId"
    > & Partial<Omit<ReleaseRow, "id" | "createdAt" | "updatedAt">>;
  }): Promise<ReleaseRow>;
  update(args: {
    where: { id: string };
    data: Partial<Omit<ReleaseRow, "id" | "organizationId" | "applicationId" | "createdAt" | "updatedAt">>;
  }): Promise<ReleaseRow>;
}

interface ReadinessSnapshotDelegate {
  create(args: { data: Omit<ReleaseReadinessSnapshotRow, "id" | "evaluatedAt"> & { evaluatedAt?: Date } }): Promise<ReleaseReadinessSnapshotRow>;
  findMany(args: {
    where: { releaseId: string };
    orderBy: { evaluatedAt: "desc" };
    take: number;
  }): Promise<ReleaseReadinessSnapshotRow[]>;
}

interface EvidencePackDelegate {
  findUnique(args: { where: { releaseId: string } }): Promise<ReleaseEvidencePackRow | null>;
  upsert(args: {
    where: { releaseId: string };
    create: Omit<ReleaseEvidencePackRow, "id" | "createdAt" | "updatedAt" | "generatedAt"> & { generatedAt?: Date };
    update: Partial<Omit<ReleaseEvidencePackRow, "id" | "organizationId" | "releaseId" | "createdAt">>;
  }): Promise<ReleaseEvidencePackRow>;
}

export interface ReleaseRepo {
  release: ReleaseDelegate;
  releaseReadinessSnapshot: ReadinessSnapshotDelegate;
  releaseEvidencePack: EvidencePackDelegate;
  $transaction<T>(fn: (tx: ReleaseRepo) => Promise<T>): Promise<T>;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface — Release CRUD.
   ────────────────────────────────────────────────────────────── */

export interface CreateReleaseInput {
  organizationId: string;
  applicationId: string;
  releaseTag?: string;
  commitSha?: string;
  targetEnvironmentId?: string;
  plannedWindowStart?: Date;
  plannedWindowEnd?: Date;
  summary?: string;
  createdByUserId?: string;
}

export async function createReleaseDraft(
  repo: ReleaseRepo,
  input: CreateReleaseInput,
): Promise<ReleaseRow> {
  return repo.release.create({
    data: {
      organizationId: input.organizationId,
      applicationId: input.applicationId,
      status: "draft",
      releaseTag: input.releaseTag ?? null,
      commitSha: input.commitSha ?? null,
      targetEnvironmentId: input.targetEnvironmentId ?? null,
      plannedWindowStart: input.plannedWindowStart ?? null,
      plannedWindowEnd: input.plannedWindowEnd ?? null,
      summary: input.summary ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

export type TransitionReleaseResult =
  | { ok: true; release: ReleaseRow; previousStatus: ReleaseStatus; nextStatus: ReleaseStatus }
  | { ok: false; reason: "illegal_transition" | "release_not_found"; from?: ReleaseStatus; to?: ReleaseStatus };

export interface TransitionReleaseInput {
  releaseId: string;
  toStatus: ReleaseStatus;
  /** Additive fields the kernel writes alongside the transition. Tests only override when relevant. */
  scopeFinalizedAt?: Date;
  scopeFinalizedByUserId?: string;
  actualDeployStart?: Date;
  actualDeployEnd?: Date;
  rollbackReferenceReleaseId?: string;
}

export async function transitionRelease(
  repo: ReleaseRepo,
  input: TransitionReleaseInput,
): Promise<TransitionReleaseResult> {
  return repo.$transaction(async (tx) => {
    const existing = await tx.release.findUnique({ where: { id: input.releaseId } });
    if (!existing) {
      return { ok: false as const, reason: "release_not_found" as const };
    }
    if (!isLegalReleaseTransition(existing.status, input.toStatus)) {
      return {
        ok: false as const,
        reason: "illegal_transition" as const,
        from: existing.status,
        to: input.toStatus,
      };
    }

    // Apply the additive timestamp stamping rules tied to specific
    // transitions. draft→ready freezes scope; ready→deploying stamps
    // start; deploying→{deployed|failed} stamps end; deployed→rolled_back
    // requires a rollback reference.
    const data: Parameters<ReleaseRepo["release"]["update"]>[0]["data"] = {
      status: input.toStatus,
    };
    if (existing.status === "draft" && input.toStatus === "ready") {
      data.scopeFinalizedAt = input.scopeFinalizedAt ?? new Date();
      data.scopeFinalizedByUserId = input.scopeFinalizedByUserId ?? null;
    }
    if (input.toStatus === "deploying") {
      data.actualDeployStart = input.actualDeployStart ?? new Date();
    }
    if (input.toStatus === "deployed" || input.toStatus === "failed") {
      data.actualDeployEnd = input.actualDeployEnd ?? new Date();
    }
    if (input.toStatus === "rolled_back") {
      if (!input.rollbackReferenceReleaseId && !existing.rollbackReferenceReleaseId) {
        return {
          ok: false as const,
          reason: "illegal_transition" as const,
          from: existing.status,
          to: input.toStatus,
        };
      }
      if (input.rollbackReferenceReleaseId) {
        data.rollbackReferenceReleaseId = input.rollbackReferenceReleaseId;
      }
    }

    const updated = await tx.release.update({
      where: { id: existing.id },
      data,
    });
    return {
      ok: true as const,
      release: updated,
      previousStatus: existing.status,
      nextStatus: input.toStatus,
    };
  });
}

/* ──────────────────────────────────────────────────────────────────
   Readiness snapshots.
   ────────────────────────────────────────────────────────────── */

export interface PersistReadinessSnapshotInput {
  organizationId: string;
  releaseId: string;
  scores: Pick<
    ReleaseReadinessSnapshotRow,
    | "branchGovernance" | "changeCompliance" | "artifactTraceability"
    | "secretTraceability" | "rollbackReadiness" | "communicationReadiness"
    | "driftRisk" | "manualReconciliation"
  >;
  blockers: ReadonlyArray<ReleaseBlocker>;
  evaluationSource: string;
  evaluatedAt?: Date;
}

export async function persistReadinessSnapshot(
  repo: ReleaseRepo,
  input: PersistReadinessSnapshotInput,
): Promise<ReleaseReadinessSnapshotRow> {
  const overallScore = computeOverallScore(input.scores);
  const riskLevel = riskLevelFor(overallScore);
  return repo.releaseReadinessSnapshot.create({
    data: {
      organizationId: input.organizationId,
      releaseId: input.releaseId,
      ...input.scores,
      overallScore,
      riskLevel,
      blockersJson: input.blockers,
      evaluationSource: input.evaluationSource,
      ...(input.evaluatedAt ? { evaluatedAt: input.evaluatedAt } : {}),
    },
  });
}

export async function listRecentReadinessSnapshots(
  repo: ReleaseRepo,
  args: { releaseId: string; take?: number },
): Promise<ReleaseReadinessSnapshotRow[]> {
  return repo.releaseReadinessSnapshot.findMany({
    where: { releaseId: args.releaseId },
    orderBy: { evaluatedAt: "desc" },
    take: args.take ?? 10,
  });
}

/* ──────────────────────────────────────────────────────────────────
   Evidence pack.
   ────────────────────────────────────────────────────────────── */

export interface UpsertEvidencePackInput {
  organizationId: string;
  releaseId: string;
  contentJson: Record<string, unknown>;
  exportRefsJson?: Record<string, string>;
  /** When set, marks the pack as sealed. Caller computes contentHash. */
  signedAt?: Date;
  contentHash?: string;
}

export async function upsertEvidencePack(
  repo: ReleaseRepo,
  input: UpsertEvidencePackInput,
): Promise<ReleaseEvidencePackRow> {
  return repo.releaseEvidencePack.upsert({
    where: { releaseId: input.releaseId },
    create: {
      organizationId: input.organizationId,
      releaseId: input.releaseId,
      contentJson: input.contentJson,
      exportRefsJson: input.exportRefsJson ?? null,
      signedAt: input.signedAt ?? null,
      contentHash: input.contentHash ?? null,
    },
    update: {
      contentJson: input.contentJson,
      ...(input.exportRefsJson !== undefined ? { exportRefsJson: input.exportRefsJson } : {}),
      ...(input.signedAt !== undefined ? { signedAt: input.signedAt } : {}),
      ...(input.contentHash !== undefined ? { contentHash: input.contentHash } : {}),
    },
  });
}

export async function readEvidencePack(
  repo: ReleaseRepo,
  args: { releaseId: string },
): Promise<ReleaseEvidencePackRow | null> {
  return repo.releaseEvidencePack.findUnique({ where: { releaseId: args.releaseId } });
}

/* ──────────────────────────────────────────────────────────────────
   Pure helpers — exported so callers/tests can pin behavior.
   ────────────────────────────────────────────────────────────── */

const READINESS_DIMENSIONS: ReadonlyArray<keyof PersistReadinessSnapshotInput["scores"]> = [
  "branchGovernance",
  "changeCompliance",
  "artifactTraceability",
  "secretTraceability",
  "rollbackReadiness",
  "communicationReadiness",
  "driftRisk",
  "manualReconciliation",
];

export function computeOverallScore(scores: PersistReadinessSnapshotInput["scores"]): number {
  // Plain mean for now. Weighted mean lands in Phase 444 when the
  // dimensions get real weights tied to policy severity.
  const total = READINESS_DIMENSIONS.reduce((acc, k) => acc + scores[k], 0);
  return Math.round(total / READINESS_DIMENSIONS.length);
}

export function riskLevelFor(overallScore: number): ReadinessRiskLevel {
  if (overallScore < 40) return "critical";
  if (overallScore < 60) return "high";
  if (overallScore < 80) return "medium";
  return "low";
}

export function isKnownReleaseStatus(s: string): s is ReleaseStatus {
  return (ALL_RELEASE_STATUSES as readonly string[]).includes(s);
}
