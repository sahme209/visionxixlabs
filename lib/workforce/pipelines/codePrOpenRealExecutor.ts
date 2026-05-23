/**
 * Real code_pr_open executor — Phase 388.
 *
 * This is the closing executor of the AI coding loop. By the time it
 * runs, two human approvers have voted YES on the proposed patch via
 * Phase 378's quorum. This executor:
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
 *   - Runs ONLY after two-step human approval (Phase 378). The
 *     pipeline runner's approval gate blocks otherwise. There is no
 *     autonomous merge path; humans must still review the actual
 *     diff in the PR before merging.
 *   - GITHUB_TOKEN absent OR repo private without access → falls
 *     back to dry-run with explicit reason.
 *   - Patch fails to apply (context mismatch, etc.) → dry-run with
 *     reason; no branch is created.
 *
 * Every failure writes workforce.pr_open_failed audit; success writes
 * workforce.pr_branch_pushed and workforce.pr_opened.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { parseRepoRef } from "./parseRepoRef";
import { parseUnifiedDiff } from "./parseUnifiedDiff";
import { applyDiff } from "./applyUnifiedDiff";
import {
  openPullRequest,
  fetchFileContent,
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

function dryRunResult(reason: string, ctx: { stageId: string; runId: string; correlationId: string }): StageExecutorResult {
  return {
    ok: true,
    summary: `[dry-run · ${reason}] would push branch + open PR.`,
    detail: {
      stageId: ctx.stageId,
      pushed: false,
      fallbackReason: reason,
      plannedBranch: `ai/${ctx.runId.slice(-8)}`,
      correlationId: ctx.correlationId,
    },
  };
}

export const codePrOpenRealExecutor: StageExecutorFn = async (ctx) => {
  // 1. No token → can't push. Fall back gracefully.
  if (!process.env.GITHUB_TOKEN) {
    return dryRunResult("no_github_token", ctx);
  }

  const meta = readMetadata(ctx.runMetadata);
  if (!meta) {
    return dryRunResult("missing_metadata", ctx);
  }

  const coords = parseRepoRef(meta.repoRef);
  if (!coords) {
    return dryRunResult("invalid_repo_ref", ctx);
  }

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
  } catch { /* fall through to dry-run */ }

  if (!proposedPatchText) {
    return dryRunResult("no_proposed_patch", ctx);
  }

  // 3. Parse the diff.
  const parsed = parseUnifiedDiff(proposedPatchText);
  if (!parsed.ok) {
    await emitFail(ctx, "diff_parse_failed", parsed.reason, parsed.detail);
    return dryRunResult(`diff_parse_${parsed.reason}`, ctx);
  }
  if (parsed.files.length === 0) {
    return dryRunResult("diff_had_no_files", ctx);
  }

  // 4. For each modified file, fetch base + apply.
  const fileChanges: FileChange[] = [];
  for (const fileDiff of parsed.files) {
    let baseContent: string | null = null;
    if (fileDiff.changeKind === "modified" || fileDiff.changeKind === "deleted") {
      const fc = await fetchFileContent(coords.owner, coords.repo, fileDiff.path, meta.branchHint ?? "HEAD");
      if (!fc.ok) {
        await emitFail(ctx, "base_fetch_failed", fc.reason, `${fileDiff.path}: ${fc.detail}`);
        return dryRunResult("base_fetch_failed", ctx);
      }
      baseContent = fc.content;
      if (fileDiff.changeKind === "modified" && baseContent === null) {
        await emitFail(ctx, "modified_file_missing_in_base", "404", fileDiff.path);
        return dryRunResult("modified_file_missing", ctx);
      }
    }

    const applied = applyDiff({ diff: fileDiff, baseContent });
    if (!applied.ok) {
      await emitFail(ctx, "diff_apply_failed", applied.reason, `${fileDiff.path}: ${applied.detail}`);
      return dryRunResult(`diff_apply_${applied.reason}`, ctx);
    }
    fileChanges.push({ path: applied.entry.path, content: applied.entry.newContent });
  }

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
    `This PR was approved by two human reviewers via the platform's two-step approval gate before this branch was pushed. Please review the diff carefully before merging.`,
  ].join("\n");

  const result: OpenPRResult = await openPullRequest({
    owner: coords.owner,
    repo: coords.repo,
    baseBranch: meta.branchHint ?? "main",
    newBranch,
    files: fileChanges,
    commitMessage,
    prTitle,
    prBody,
  });

  if (!result.ok) {
    await emitFail(ctx, "pr_open_failed", result.reason, result.detail);
    return dryRunResult(`pr_open_${result.reason}`, ctx);
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
        baseBranch: meta.branchHint ?? "main",
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
        baseBranch: meta.branchHint ?? "main",
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
      baseBranch: meta.branchHint ?? "main",
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
