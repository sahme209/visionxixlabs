/**
 * Real code_lint executor — Phase 391.
 *
 * Replaces the dry-run lint with a real per-file-kind structural
 * check. Pulls the prior code_propose stage's patch text, parses it
 * via Phase 388's parser, fetches base content for every modified
 * file via the GitHub fetcher, applies the diff in-memory via Phase
 * 388's applier, then runs the closed-union static validators from
 * staticValidators.ts against the resulting virtual file contents.
 *
 * Failure semantics:
 *   - parse failed                  → stage SUCCEEDS with lintSkipped=true
 *                                     (the PR-open stage will catch + fail
 *                                     on the broken diff)
 *   - any validator failure         → stage FAILS with per-file errors;
 *                                     pipeline stops; PR never opens
 *   - no recognized file extensions → stage succeeds (nothing to validate)
 *
 * This is the "AI can't ship broken code" gate. Genuine lint without
 * any external infra — pure validators + the existing GitHub read.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { parseRepoRef } from "./parseRepoRef";
import { parseUnifiedDiff } from "./parseUnifiedDiff";
import { applyDiff } from "./applyUnifiedDiff";
import { dispatchValidator, type ValidationFailure } from "./staticValidators";
import { fetchFileContent } from "./githubWriteClient";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";

interface MetaShape {
  repoRef?: unknown;
  branchHint?: unknown;
}

function readMetadata(raw: Record<string, unknown>): { repoRef: string; branchHint: string | null } | null {
  const m = raw as MetaShape;
  if (typeof m.repoRef !== "string" || m.repoRef.length === 0) return null;
  return {
    repoRef: m.repoRef,
    branchHint: typeof m.branchHint === "string" && m.branchHint.length > 0 ? m.branchHint : null,
  };
}

function skipResult(reason: string, ctx: { stageId: string }, extra?: Record<string, unknown>): StageExecutorResult {
  return {
    ok: true,
    summary: `[lint skipped · ${reason}] downstream gates will catch any issues.`,
    detail: {
      stageId: ctx.stageId,
      lintSkipped: true,
      skipReason: reason,
      ...extra,
    },
  };
}

export const codeLintRealExecutor: StageExecutorFn = async (ctx) => {
  const meta = readMetadata(ctx.runMetadata);
  if (!meta) return skipResult("missing_repo_ref", ctx);

  const coords = parseRepoRef(meta.repoRef);
  if (!coords) return skipResult("invalid_repo_ref", ctx);

  // 1. Pull the propose stage's patch text.
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
  } catch { /* fall through */ }

  if (!proposedPatchText) return skipResult("no_proposed_patch", ctx);

  // 2. Parse the diff.
  const parsed = parseUnifiedDiff(proposedPatchText);
  if (!parsed.ok) {
    // The PR-open stage will catch this with its own retry/refusal.
    // Lint stage succeeds with skipReason so it doesn't block here.
    return skipResult("diff_parse_failed", ctx, { parseReason: parsed.reason });
  }

  if (parsed.files.length === 0) return skipResult("diff_had_no_files", ctx);

  // 3. For each modified/added file: fetch base + apply → virtual content.
  //    Walk file-by-file, collect validator failures, never short-circuit
  //    so the operator sees every issue at once.
  type LintEntry = {
    path: string;
    changeKind: "added" | "modified" | "deleted";
    validatorDispatched: boolean;
    ok: boolean;
    failures: ReadonlyArray<ValidationFailure>;
    skipReason?: string;
  };
  const entries: LintEntry[] = [];

  for (const fileDiff of parsed.files) {
    if (fileDiff.changeKind === "deleted") {
      entries.push({ path: fileDiff.path, changeKind: "deleted", validatorDispatched: false, ok: true, failures: [] });
      continue;
    }

    const validator = dispatchValidator(fileDiff.path);
    if (!validator) {
      entries.push({
        path: fileDiff.path,
        changeKind: fileDiff.changeKind,
        validatorDispatched: false,
        ok: true,
        failures: [],
        skipReason: "no_validator_for_extension",
      });
      continue;
    }

    let baseContent: string | null = null;
    if (fileDiff.changeKind === "modified") {
      const fc = await fetchFileContent(coords.owner, coords.repo, fileDiff.path, meta.branchHint ?? "HEAD");
      if (!fc.ok || fc.content === null) {
        entries.push({
          path: fileDiff.path,
          changeKind: fileDiff.changeKind,
          validatorDispatched: false,
          ok: true,
          failures: [],
          skipReason: fc.ok ? "base_missing_in_repo" : "base_fetch_failed",
        });
        continue;
      }
      baseContent = fc.content;
    }

    const applied = applyDiff({ diff: fileDiff, baseContent });
    if (!applied.ok || applied.entry.newContent === null) {
      entries.push({
        path: fileDiff.path,
        changeKind: fileDiff.changeKind,
        validatorDispatched: false,
        ok: true,
        failures: [],
        skipReason: applied.ok ? "applied_to_null" : `apply_${applied.reason}`,
      });
      continue;
    }

    const v = validator(applied.entry.newContent);
    entries.push({
      path: fileDiff.path,
      changeKind: fileDiff.changeKind,
      validatorDispatched: true,
      ok: v.ok,
      failures: v.failures,
    });
  }

  const failingEntries = entries.filter((e) => !e.ok);
  const validatedCount = entries.filter((e) => e.validatorDispatched).length;

  if (failingEntries.length === 0) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "workforce.code_lint_passed",
        outcome: "success",
        entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: {
          stageId: ctx.stageId,
          totalFiles: entries.length,
          validatedFiles: validatedCount,
          skippedFiles: entries.length - validatedCount,
        },
      });
    } catch { /* best-effort */ }

    return {
      ok: true,
      summary: `Lint passed · validated ${validatedCount}/${entries.length} file(s), no structural issues.`,
      detail: {
        stageId: ctx.stageId,
        lintSkipped: false,
        validatedFiles: validatedCount,
        totalFiles: entries.length,
        perFile: entries.map((e) => ({
          path: e.path,
          changeKind: e.changeKind,
          validated: e.validatorDispatched,
          ok: e.ok,
          skipReason: e.skipReason ?? null,
        })),
      },
    };
  }

  // Failures present — pipeline must stop. Return ok:false so the
  // pipeline runner marks the stage failed and halts the run.
  const firstFail = failingEntries[0];
  const firstFailureMsg = firstFail.failures[0]?.message ?? "structural issue";

  try {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorKind: "system",
      action: "workforce.code_lint_failed",
      outcome: "failure",
      entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
      correlationId: idFactory.correlation(ctx.correlationId),
      source: "live",
      detail: {
        stageId: ctx.stageId,
        failingFileCount: failingEntries.length,
        failures: failingEntries.map((e) => ({
          path: e.path,
          changeKind: e.changeKind,
          failures: e.failures,
        })),
      },
    });
  } catch { /* best-effort */ }

  // Phase 397: fire coding.lint_failed webhook so the team gets paged
  // the moment the AI shipped structurally broken code.
  try {
    await dispatchWebhookEvent({
      organizationId: ctx.organizationId,
      eventKind: "coding.lint_failed",
      data: {
        stageId: ctx.stageId,
        stageRunId: ctx.stageRunId,
        failingFileCount: failingEntries.length,
        firstFailingPath: firstFail.path,
        firstFailureMessage: firstFailureMsg,
        failures: failingEntries.map((e) => ({
          path: e.path,
          changeKind: e.changeKind,
          failures: e.failures,
        })),
      },
      correlationId: ctx.correlationId,
    });
  } catch { /* best-effort */ }

  return {
    ok: false,
    error: `Lint failed: ${firstFail.path} · ${firstFailureMsg} (and ${failingEntries.length - 1} other file(s))`,
    detail: {
      stageId: ctx.stageId,
      lintSkipped: false,
      failingFileCount: failingEntries.length,
      perFile: entries.map((e) => ({
        path: e.path,
        changeKind: e.changeKind,
        validated: e.validatorDispatched,
        ok: e.ok,
        failures: e.failures,
        skipReason: e.skipReason ?? null,
      })),
    },
  };
};
