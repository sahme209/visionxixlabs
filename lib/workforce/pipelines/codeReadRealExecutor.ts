/**
 * Real code_read executor — Phase 387.
 *
 * Replaces the dry-run code_read with a real GitHub REST fetch that
 * builds a structured RepoSnapshot, summarizes it into prompt text,
 * and stores the result in the stage's outputDetail JSONB so the
 * downstream code_propose stage can read it.
 *
 * Failed repository reads stop the coding stage. A missing repository context
 * is never reported as a successful scan or silently replaced by an
 * instruction-only proposal.
 */

import "server-only";

import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import {
  fetchRepoContext,
  type FetchRepoContextResult,
} from "./repoContextFetcher";
import { parseRepoRef } from "./parseRepoRef";
import { resolveCodingGithubCredential } from "./codingGithubCredential";
import { summarizeRepoContext } from "./summarizeRepoContext";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";

interface ReadMetadataInput {
  repoRef?: unknown;
  branchHint?: unknown;
}

function readMetadata(raw: Record<string, unknown>): { repoRef: string; branchHint: string | null } | null {
  const m = raw as ReadMetadataInput;
  if (typeof m.repoRef !== "string" || m.repoRef.length === 0) return null;
  return {
    repoRef: m.repoRef,
    branchHint: typeof m.branchHint === "string" && m.branchHint.length > 0 ? m.branchHint : null,
  };
}

function failedReadResult(reason: string, ctx: { stageId: string; runMetadata: Record<string, unknown> }): StageExecutorResult {
  return {
    ok: false,
    error: `Repository context could not be read (${reason}). Coding has stopped before generation.`,
    detail: {
      stageId: ctx.stageId,
      fetchedFromGitHub: false,
      fallbackReason: reason,
      repoContext: "",
      repoRef: typeof (ctx.runMetadata as ReadMetadataInput).repoRef === "string" ? (ctx.runMetadata as ReadMetadataInput).repoRef : null,
    },
  };
}

export const codeReadRealExecutor: StageExecutorFn = async (ctx) => {
  const meta = readMetadata(ctx.runMetadata);
  if (!meta) {
    return failedReadResult("missing_repo_ref", ctx);
  }

  const repository = parseRepoRef(meta.repoRef);
  if (!repository) return failedReadResult("invalid_repo_ref", ctx);
  const credential = await resolveCodingGithubCredential(ctx.organizationId, repository);
  if (!credential.ok) return failedReadResult(credential.error, ctx);

  let result: FetchRepoContextResult;
  try {
    result = await fetchRepoContext(meta.repoRef, meta.branchHint, credential.token);
  } catch (err) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "workforce.repo_context_fetch_failed",
        outcome: "failure",
        entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: {
          stageId: ctx.stageId,
          repoRef: meta.repoRef,
          reason: "thrown",
          error: err instanceof Error ? err.message : "unknown",
        },
      });
    } catch { /* best-effort */ }
    return failedReadResult("github_fetch_threw", ctx);
  }

  if (!result.ok) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "workforce.repo_context_fetch_failed",
        outcome: "failure",
        entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: {
          stageId: ctx.stageId,
          repoRef: meta.repoRef,
          reason: result.reason,
          detailMsg: result.detail,
        },
      });
    } catch { /* best-effort */ }
    return failedReadResult(result.reason, ctx);
  }

  const snapshot = result.snapshot;
  const repoContext = summarizeRepoContext(snapshot);

  try {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorKind: "system",
      action: "workforce.repo_context_fetched",
      outcome: "success",
      entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
      correlationId: idFactory.correlation(ctx.correlationId),
      source: "live",
      detail: {
        stageId: ctx.stageId,
        repoRef: meta.repoRef,
        owner: snapshot.owner,
        repo: snapshot.repo,
        branch: snapshot.branch,
        headSha: snapshot.headSha,
        treeCount: snapshot.tree.length,
        treeTruncated: snapshot.treeTruncated,
        keyFileCount: snapshot.keyFiles.length,
        recentCommitCount: snapshot.recentCommits.length,
        contextBytes: repoContext.length,
      },
    });
  } catch { /* best-effort */ }

  return {
    ok: true,
    summary: `Scanned ${snapshot.owner}/${snapshot.repo}@${snapshot.branch} — ${snapshot.tree.length}${snapshot.treeTruncated ? "+" : ""} files, ${snapshot.keyFiles.length} key files, ${snapshot.recentCommits.length} recent commits.`,
    detail: {
      stageId: ctx.stageId,
      fetchedFromGitHub: true,
      owner: snapshot.owner,
      repo: snapshot.repo,
      branch: snapshot.branch,
      headSha: snapshot.headSha,
      treeCount: snapshot.tree.length,
      treeTruncated: snapshot.treeTruncated,
      keyFiles: snapshot.keyFiles.map((f) => ({ path: f.path, truncated: f.truncated, bytes: f.content.length })),
      recentCommitCount: snapshot.recentCommits.length,
      repoContext,                        // <-- the prompt-ready text
      contextBytes: repoContext.length,
    },
  };
};
