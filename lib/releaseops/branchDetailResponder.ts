/**
 * Phase 460 — release-branch detail responder.
 *
 * Renders one release's branch-validation checklist + the underlying
 * PR + release-tag + workflow rows. Web + desktop consume the same
 * shape.
 */

import {
  evaluateBranchValidation,
  type BranchValidationContext,
  type BranchValidationCheckResult,
} from "./branchValidationEvaluator";
import {
  diffReleaseTags,
  type GitDiscoveryRepo,
  type PullRequestRecordRow,
  type ReleaseTagRecordRow,
  type WorkflowRunRecordRow,
} from "./gitDiscoveryRepo";
import { isMissingTable } from "./releaseListResponder";
import {
  branchValidationCheckLabel,
  type BranchValidationCheckKey,
} from "./branchValidationSession";

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export interface BranchDetailViewRow {
  key: BranchValidationCheckKey;
  label: string;
  state: BranchValidationCheckResult["state"];
  detail: string;
}

export interface BranchDetailBody {
  ok: true;
  data: {
    generatedAt: string;
    releaseId: string;
    repositoryDisplayName: string;
    releaseTag: string | null;
    headPrNumber: number | null;
    checks: BranchDetailViewRow[];
    summary: {
      total: number;
      passing: number;
      failing: number;
      notApplicable: number;
      unknown: number;
    };
    /** Newly-included PR count from the diff against previous prod, if computable. */
    diffSummary: { newlyIncludedPrCount: number; droppedPrCount: number } | null;
    lastWorkflowRun: { name: string; status: string; conclusion: string | null } | null;
  };
}

export type ResponseBody = BranchDetailBody | { ok: false; error: string; hint?: string; correlationId?: string };
export interface ResponderResult { status: number; body: ResponseBody }

/* ──────────────────────────────────────────────────────────────────
   Repo contract — adds two narrow lookups the responder needs.
   ────────────────────────────────────────────────────────────── */

export interface BranchDetailRepo extends GitDiscoveryRepo {
  /** Lookups we don't have on the GitDiscoveryRepo contract. */
  release: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string; organizationId: string; releaseTag: string | null; commitSha: string | null;
    } | null>;
  };
  repository: {
    findUnique(args: { where: { id: string } }): Promise<{
      id: string; remoteOwner: string; remoteName: string;
    } | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export interface BuildBranchDetailInput {
  organizationId: string;
  releaseId: string;
  repositoryId: string;
  isProductionDeploy: boolean;
  branchEnvPolicy: BranchValidationContext["branchEnvPolicy"];
  directPushBlocked: boolean;
  branchUpToDateWithTarget: boolean;
  hasRollbackReference: boolean;
  changedFilesWithinApprovedScope: boolean | null;
  now?: Date;
  correlationId?: string;
}

export async function buildBranchDetailResponse(
  repo: BranchDetailRepo,
  input: BuildBranchDetailInput,
): Promise<ResponderResult> {
  try {
    const now = input.now ?? new Date();
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release || release.organizationId !== input.organizationId) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    const repository = await repo.repository.findUnique({ where: { id: input.repositoryId } });
    if (!repository) {
      return { status: 404, body: { ok: false, error: "repository_not_found" } };
    }

    // Pull the relevant rows.
    let pr: PullRequestRecordRow | null = null;
    if (release.commitSha) {
      const prs = await repo.pullRequestRecord.findMany({
        where: { organizationId: input.organizationId, repositoryId: input.repositoryId, commitShaHead: release.commitSha },
        orderBy: { updatedAt: "desc" },
        take: 1,
      });
      pr = prs[0] ?? null;
    }

    let releaseTag: ReleaseTagRecordRow | null = null;
    let diffSummary: { newlyIncludedPrCount: number; droppedPrCount: number } | null = null;
    if (release.releaseTag) {
      const tags = await repo.releaseTagRecord.findMany({
        where: { organizationId: input.organizationId, repositoryId: input.repositoryId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      releaseTag = tags.find((t) => t.tagName === release.releaseTag) ?? null;
      if (releaseTag) {
        const idx = tags.findIndex((t) => t.id === releaseTag!.id);
        const previous = tags[idx + 1];
        if (previous) {
          const d = diffReleaseTags(previous, releaseTag);
          diffSummary = { newlyIncludedPrCount: d.newlyIncludedPrIds.length, droppedPrCount: d.droppedPrIds.length };
        }
      }
    }

    let workflowRuns: WorkflowRunRecordRow[] = [];
    if (release.commitSha) {
      workflowRuns = await repo.workflowRunRecord.findMany({
        where: { organizationId: input.organizationId, commitSha: release.commitSha },
        orderBy: { startedAt: "desc" },
        take: 25,
      });
    }

    const ctx: BranchValidationContext = {
      pr, releaseTag, workflowRuns,
      isProductionDeploy: input.isProductionDeploy,
      diffAgainstPreviousProd: releaseTag && diffSummary
        ? {
            fromTag: "previous",
            toTag: releaseTag.tagName,
            prCount: (releaseTag.prListJson ?? []).length,
            commitCount: (releaseTag.commitListJson ?? []).length,
            newlyIncludedPrIds: [],
            droppedPrIds: diffSummary.droppedPrCount > 0 ? Array(diffSummary.droppedPrCount).fill("dropped") : [],
          }
        : null,
      branchEnvPolicy: input.branchEnvPolicy,
      directPushBlocked: input.directPushBlocked,
      branchUpToDateWithTarget: input.branchUpToDateWithTarget,
      hasRollbackReference: input.hasRollbackReference,
      changedFilesWithinApprovedScope: input.changedFilesWithinApprovedScope,
    };
    const evaluation = evaluateBranchValidation(ctx);
    const checks: BranchDetailViewRow[] = evaluation.results.map((r) => ({
      key: r.key,
      label: branchValidationCheckLabel(r.key),
      state: r.state,
      detail: r.detail,
    }));

    const latestRun = workflowRuns[0] ?? null;
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          releaseId: release.id,
          repositoryDisplayName: `${repository.remoteOwner}/${repository.remoteName}`,
          releaseTag: release.releaseTag,
          headPrNumber: pr?.number ?? null,
          checks,
          summary: {
            total: checks.length,
            passing: evaluation.passCount,
            failing: evaluation.failCount,
            notApplicable: evaluation.notApplicableCount,
            unknown: evaluation.unknownCount,
          },
          diffSummary,
          lastWorkflowRun: latestRun
            ? { name: latestRun.workflowName, status: latestRun.status, conclusion: latestRun.conclusion }
            : null,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "Phase A migration not applied yet." } };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(input.correlationId ? { correlationId: input.correlationId } : {}) },
    };
  }
}
