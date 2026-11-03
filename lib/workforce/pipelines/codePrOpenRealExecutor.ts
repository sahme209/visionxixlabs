/**
 * Real code_pr_open executor — Phase 388.
 *
 * This is the closing executor of the AI coding loop. By the time it
 * runs, the configured approval gate has allowed the stage to advance.
 * Approval principals may include API keys. This executor:
 *
 *   1. Pulls the propose stage's text output (containing the diff).
 *   2. Parses it via parseUnifiedDiff.
 *   3. For every modified file, fetches base content from GitHub.
 *   4. Applies the diff in-memory via applyUnifiedDiff.
 *   5. Pushes a new branch via the Git Data API: blobs → tree →
 *      commit → ref.
 *   6. Opens a PR from the new branch into the base branch.
 *
 * Safety:
 *   - Runs only after the configured pipeline approval gate. The
 *     pipeline runner's approval gate blocks otherwise. There is no
 *     autonomous merge path; humans must still review the actual
 *     diff in the PR before merging.
 *   - Missing workspace-scoped credentials or repository access stop the stage.
 *   - An invalid or inapplicable patch stops before any repository write.
 *   - Write failures remain failures, with uncertain branch outcomes explicit.
 *
 * Every failure writes workforce.pr_open_failed audit; success writes
 * workforce.pr_branch_pushed and workforce.pr_opened.
 */

import "server-only";
import {createCodingOutboundLifecycle} from "./codingOutboundDrain";
import { loadApprovedCodingArtifact } from "./approvedCodingArtifact";
import { loadCodingReadSnapshot } from "./codingReadSnapshot";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { createCodingWriteAuthority, resolveCodingGithubCredential, readCodingGithubFile } from "./codingGithubCredential";
import { parseRepoRef } from "./parseRepoRef";
import { parseUnifiedDiff } from "./parseUnifiedDiff";
import { applyDiff } from "./applyUnifiedDiff";
import {
  openPullRequest,
  type FileChange,
  type OpenPRResult,
} from "./githubWriteClient";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

interface ReadMetadata {
  repoRef?: unknown;
  branchHint?: unknown;
  instruction?: unknown;
}

function readMetadata(raw: Record<string, unknown>): { repoRef: string; branchHint: string | null; instruction: string } | null {
  const m = raw as ReadMetadata;
  if (typeof m.repoRef !== "string" || m.repoRef.length === 0) return null;
  if (typeof m.instruction !== "string" || m.instruction.length === 0) return null;
  return {
    repoRef: m.repoRef,
    branchHint: typeof m.branchHint === "string" && m.branchHint.length > 0 ? m.branchHint : null,
    instruction: m.instruction,
  };
}

function failedPRResult(reason: string, ctx: { stageId: string; runId: string; correlationId: string }, writeMayHaveOccurred = false): StageExecutorResult {
  return {
    ok: false,
    error: `Pull request completion could not be confirmed (${reason}).${writeMayHaveOccurred ? " A repository write may have occurred; inspect the run branch before retrying." : " No repository write was attempted."}`,
    detail: {
      stageId: ctx.stageId,
      ...(writeMayHaveOccurred ? {} : { pushed: false }),
      repositoryWriteOutcome: writeMayHaveOccurred ? "unknown" : "not_attempted",
      fallbackReason: reason,
      plannedBranch: `ai/${ctx.runId.slice(-8)}`,
      correlationId: ctx.correlationId,
    },
  };
}

export const codePrOpenRealExecutor: StageExecutorFn = async (ctx) => {
  const meta = readMetadata(ctx.runMetadata);
  if (!meta) {
    return failedPRResult("missing_metadata", ctx);
  }

  const coords = parseRepoRef(meta.repoRef);
  if (!coords) {
    return failedPRResult("invalid_repo_ref", ctx);
  }

  if(!ctx.codingClaim)return failedPRResult("coding_stage_claim_required",ctx);
  const lifecycle=createCodingOutboundLifecycle(prisma,ctx.codingClaim,AbortSignal.timeout(600000));
  const authority = await createCodingWriteAuthority(ctx.organizationId, coords,purpose=>lifecycle.current(purpose==='issuance'?'credential_pending':undefined));
  if (!authority.ok) return failedPRResult(authority.error, ctx);

  // 2. Pull the propose stage's patch text from outputDetail.
  let proposedPatchText: string | null = null;
  try {
    const prior = await prisma.pipelineStageRun.findFirst({
      where: { runId: ctx.runId, stageKind: "code_propose", status: "succeeded" },
      orderBy: { completedAt: "desc" },
      select: { outputDetail: true },
    });
    const d = prior?.outputDetail as { proposedPatchText?: unknown } | null;
    if (d && typeof d.proposedPatchText === "string" && d.proposedPatchText.length > 0) {
      proposedPatchText = d.proposedPatchText;
    }
  } catch { /* handled as an unavailable patch below */ }

  if (!proposedPatchText) {
    return failedPRResult("no_proposed_patch", ctx);
  }

  // 3. Parse the diff.
  const parsed = parseUnifiedDiff(proposedPatchText);
  if (!parsed.ok) {
    await emitFail(ctx, "diff_parse_failed", parsed.reason, parsed.detail);
    return failedPRResult(`diff_parse_${parsed.reason}`, ctx);
  }
  if (parsed.files.length === 0) {
    return failedPRResult("diff_had_no_files", ctx);
  }

  // Every patch base must come from the successful read in this exact run,
  // never a fresh moving branch or a caller-supplied metadata SHA.
  const reviewedBase = await loadCodingReadSnapshot(ctx.organizationId, ctx.runId, coords);
  if (!reviewedBase) return failedPRResult("reviewed_base_unavailable", ctx);

  const scope={organizationId:ctx.organizationId,runId:ctx.runId,actorUserId:ctx.triggeredBy};
  const approved=await loadApprovedCodingArtifact(scope);
  if(!approved.ok)return failedPRResult("coding_artifact_approval_unavailable",ctx);
  const artifact=approved.artifact;
  if(artifact.repositoryFullName!==`${coords.owner}/${coords.repo}` || artifact.baseBranch!==reviewedBase.branch || artifact.baseCommitSha!==reviewedBase.headSha || artifact.patchText!==proposedPatchText)return failedPRResult("coding_artifact_changed",ctx);

  // 4. For each modified file, fetch base + apply.
  const fileChanges: FileChange[] = [];
  for (const fileDiff of parsed.files) {
    let baseContent: string | null = null;
    if (["modified", "deleted", "added"].includes(fileDiff.changeKind)) {
      const fc = await readCodingGithubFile(ctx.organizationId, coords, fileDiff.path, reviewedBase.headSha);
      if (!fc.ok) {
        await emitFail(ctx, "base_fetch_failed", fc.reason, `${fileDiff.path}: ${fc.detail}`);
        return failedPRResult("base_fetch_failed", ctx);
      }
      if (fileDiff.changeKind === "added" && fc.content !== null) return failedPRResult("added_path_already_exists", ctx);
      baseContent = fc.content;
      if ((fileDiff.changeKind === "modified" || fileDiff.changeKind === "deleted") && baseContent === null) {
        await emitFail(ctx, "modified_file_missing_in_base", "404", fileDiff.path);
        return failedPRResult("required_file_missing", ctx);
      }
    }

    const applied = applyDiff({ diff: fileDiff, baseContent });
    if (!applied.ok) {
      await emitFail(ctx, "diff_apply_failed", applied.reason, `${fileDiff.path}: ${applied.detail}`);
      return failedPRResult(`diff_apply_${applied.reason}`, ctx);
    }
    fileChanges.push({ path: applied.entry.path, content: applied.entry.newContent });
  }

  const actualFiles=[...fileChanges].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(actualFiles.length!==artifact.files.length || actualFiles.some((file,index)=>file.path!==artifact.files[index].path || file.content!==artifact.files[index].after))return failedPRResult("coding_artifact_changed",ctx);

  // 5. Push branch + open PR.
  const newBranch = `ai/${ctx.runId.slice(-8)}`;
  const commitMessage = `[ai-coding] ${meta.instruction.slice(0, 60)}\n\nApplied via VisionXIXLabs AI coding loop.\nCorrelation: ${ctx.correlationId}`;
  const prTitle = `[ai-coding] ${meta.instruction.slice(0, 80)}`;
  const prBody = [
    `Staged by the VisionXIXLabs AI coding loop.`,
    ``,
    `**Instruction:** ${meta.instruction}`,
    `**Correlation:** \`${ctx.correlationId}\``,
    `**Run id:** \`${ctx.runId}\``,
    ``,
    `This change passed the platform's configured approval gate before this branch was pushed. Approval principals may include authenticated API keys; this does not assert two distinct human reviewers. Please review the diff carefully before merging.`,
  ].join("\n");

  // Revalidate the workspace connection immediately before repository writes.
  const result: OpenPRResult = await openPullRequest({
    resolveToken: async () => {
      const current=await loadApprovedCodingArtifact(scope);
      if(!current.ok || current.digest!==approved.digest)return {ok:false as const,error:"coding_artifact_approval_unavailable"};
      return authority.resolveToken();
    },
    lifecycle,
    resolveReadToken:()=>resolveCodingGithubCredential(ctx.organizationId,coords),
    owner: coords.owner,
    repo: coords.repo,
    baseBranch: reviewedBase.branch,
    expectedBaseSha: reviewedBase.headSha,
    newBranch,
    files: actualFiles,
    commitMessage,
    prTitle,
    prBody,
  });

  if (!result.ok) {
    await emitFail(ctx, "pr_open_failed", result.reason, result.detail);
    return failedPRResult(`pr_open_${result.reason}`, ctx, result.writeMayHaveOccurred ?? !["no_token", "base_identity_required", "base_changed", "branch_not_found"].includes(result.reason));
  }

  // 6. Success audits.
  try {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorKind: "system",
      action: "workforce.pr_branch_pushed",
      outcome: "success",
      entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
      correlationId: idFactory.correlation(ctx.correlationId),
      source: "live",
      detail: {
        owner: coords.owner,
        repo: coords.repo,
        baseBranch: reviewedBase.branch,
        newBranch,
        headSha: result.headSha,
        fileCount: fileChanges.length,
      },
    });
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorKind: "system",
      action: "workforce.pr_opened",
      outcome: "success",
      entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
      correlationId: idFactory.correlation(ctx.correlationId),
      source: "live",
      detail: {
        owner: coords.owner,
        repo: coords.repo,
        prNumber: result.prNumber,
        prUrl: result.prUrl,
      },
    });
  } catch { /* best-effort */ }

  // Phase 397: fire coding.pr_opened webhook so integrators get notified
  // the moment a PR is opened — typical use is posting to Slack/Linear/etc.
  try {
    await dispatchWebhookEvent({
      organizationId: ctx.organizationId,
      eventKind: "coding.pr_opened",
      data: {
        owner: coords.owner,
        repo: coords.repo,
        prNumber: result.prNumber,
        prUrl: result.prUrl,
        baseBranch: reviewedBase.branch,
        headBranch: newBranch,
        headSha: result.headSha,
        fileCount: fileChanges.length,
        stageRunId: ctx.stageRunId,
      },
      correlationId: ctx.correlationId,
    });
  } catch { /* best-effort */ }

  return {
    ok: true,
    summary: `Opened PR #${result.prNumber} — ${result.prUrl}`,
    detail: {
      stageId: ctx.stageId,
      pushed: true,
      owner: coords.owner,
      repo: coords.repo,
      baseBranch: reviewedBase.branch,
      newBranch,
      headSha: result.headSha,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      fileCount: fileChanges.length,
      fileChanges: fileChanges.map((f) => ({ path: f.path, deleted: f.content === null })),
    },
  };
};

async function emitFail(
  ctx: { organizationId: string; stageRunId: string; correlationId: string; stageId: string },
  kind: string,
  reason: string,
  detail: string,
): Promise<void> {
  try {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorKind: "system",
      action: "workforce.pr_open_failed",
      outcome: "failure",
      entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
      correlationId: idFactory.correlation(ctx.correlationId),
      source: "live",
      detail: { stageId: ctx.stageId, kind, reason, detail },
    });
  } catch { /* best-effort */ }
}
