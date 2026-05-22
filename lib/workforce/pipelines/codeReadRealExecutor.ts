/**
 * Real code_read executor — Phase 387.
 *
 * Replaces the dry-run code_read with a real GitHub REST fetch that
 * builds a structured RepoSnapshot, summarizes it into prompt text,
 * and stores the result in the stage's outputDetail JSONB so the
 * downstream code_propose stage can read it.
 *
 * Failure modes are all graceful — the executor returns a successful
 * dry-run-style result with `fetchedFromGitHub: false` and an
 * explanatory reason. The propose stage will see the empty
 * repoContext and prompt Claude to code from operator instruction
 * alone, the same as before. So GitHub flakiness or missing tokens
 * never block the pipeline.
 */

import "server-only";

import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import {
  fetchRepoContext,
  type FetchRepoContextResult,
} from "./repoContextFetcher";
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

function fallbackResult(reason: string, ctx: { stageId: string; runMetadata: Record<string, unknown> }): StageExecutorResult {
  return {
    ok: true,
    summary: `[dry-run · ${reason}] code_read fell back. Propose stage will work from instruction alone.`,
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
    return fallbackResult("missing_repo_ref", ctx);
  }

  let result: FetchRepoContextResult;
  try {
    result = await fetchRepoContext(meta.repoRef, meta.branchHint);
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
    return fallbackResult("github_fetch_threw", ctx);
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
    return fallbackResult(result.reason, ctx);
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
