/**
 * Real code_test executor — Phase 392.
 *
 * Replaces the dry-run test stage with an assertion-integrity gate.
 * We don't run tests in serverless — we *audit* the AI's changes to
 * test files and flag the patterns most likely to be the model
 * making tests pass by cheating:
 *
 *   - deleting `it(...)` cases outright
 *   - deleting whole `describe(...)` blocks
 *   - weakening matchers (`.toBe(specific)` → `.toBeTruthy()`)
 *   - removing `expect(...)` calls
 *   - re-skipping previously-active tests
 *
 * Pulls the prior code_propose stage's patch text, parses it via the
 * Phase 388 parser, fetches base content per modified test file via
 * the GitHub fetcher, applies the diff in-memory via the Phase 388
 * applier, then diffs the test surface via the Phase 392 analyzer.
 *
 * Failure semantics (same shape as code_lint):
 *   - parse failed                  → stage SUCCEEDS with testSkipped=true
 *                                     (the lint + PR-open stages catch it)
 *   - any analyzer finding          → stage FAILS; pipeline stops; PR never opens
 *   - no test files in the patch    → stage succeeds (nothing to check)
 *
 * Pairs with code_lint as the second half of the "AI can't ship broken
 * or cheating code" gate.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { parseRepoRef } from "./parseRepoRef";
import { parseUnifiedDiff } from "./parseUnifiedDiff";
import { applyDiff } from "./applyUnifiedDiff";
import { analyzeTestChange, isTestFilePath, type TestFinding } from "./testAssertionAnalyzer";
import { fetchFileContent } from "./githubWriteClient";

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
    summary: `[test skipped · ${reason}] no assertion-integrity issues to surface.`,
    detail: {
      stageId: ctx.stageId,
      testSkipped: true,
      skipReason: reason,
      ...extra,
    },
  };
}

export const codeTestRealExecutor: StageExecutorFn = async (ctx) => {
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
    return skipResult("diff_parse_failed", ctx, { parseReason: parsed.reason });
  }

  // 3. Identify modified test files only. Added test files don't have a
  //    base to compare against, so they're informational; deleted test
  //    files are an obvious red flag and surface as a separate finding.
  type TestEntry = {
    path: string;
    changeKind: "added" | "modified" | "deleted";
    analyzed: boolean;
    ok: boolean;
    findings: ReadonlyArray<TestFinding>;
    counts?: {
      baseTestCount: number;
      newTestCount: number;
      baseExpectCount: number;
      newExpectCount: number;
    };
    skipReason?: string;
  };
  const entries: TestEntry[] = [];

  for (const fileDiff of parsed.files) {
    if (!isTestFilePath(fileDiff.path)) continue;

    // Deleting an entire test file is itself suspicious — fold it into the
    // findings stream as a synthetic "deleted_test_case" rolled-up entry.
    if (fileDiff.changeKind === "deleted") {
      entries.push({
        path: fileDiff.path,
        changeKind: "deleted",
        analyzed: false,
        ok: false,
        findings: [{
          kind: "deleted_test_case",
          message: `Entire test file ${fileDiff.path} was deleted by the patch.`,
        }],
      });
      continue;
    }

    if (fileDiff.changeKind === "added") {
      // No base to compare against; flag the addition for audit but don't
      // fail the gate — new tests are good.
      entries.push({
        path: fileDiff.path,
        changeKind: "added",
        analyzed: false,
        ok: true,
        findings: [],
        skipReason: "new_test_file",
      });
      continue;
    }

    const fc = await fetchFileContent(coords.owner, coords.repo, fileDiff.path, meta.branchHint ?? "HEAD");
    if (!fc.ok || fc.content === null) {
      entries.push({
        path: fileDiff.path,
        changeKind: fileDiff.changeKind,
        analyzed: false,
        ok: true,
        findings: [],
        skipReason: fc.ok ? "base_missing_in_repo" : "base_fetch_failed",
      });
      continue;
    }

    const applied = applyDiff({ diff: fileDiff, baseContent: fc.content });
    if (!applied.ok || applied.entry.newContent === null) {
      entries.push({
        path: fileDiff.path,
        changeKind: fileDiff.changeKind,
        analyzed: false,
        ok: true,
        findings: [],
        skipReason: applied.ok ? "applied_to_null" : `apply_${applied.reason}`,
      });
      continue;
    }

    const a = analyzeTestChange({ baseContent: fc.content, newContent: applied.entry.newContent });
    entries.push({
      path: fileDiff.path,
      changeKind: fileDiff.changeKind,
      analyzed: true,
      ok: a.ok,
      findings: a.findings,
      counts: {
        baseTestCount: a.baseTestCount,
        newTestCount: a.newTestCount,
        baseExpectCount: a.baseExpectCount,
        newExpectCount: a.newExpectCount,
      },
    });
  }

  // No test files touched at all — nothing to do.
  if (entries.length === 0) return skipResult("no_test_files_in_patch", ctx);

  const failingEntries = entries.filter((e) => !e.ok);
  const analyzedCount = entries.filter((e) => e.analyzed).length;

  if (failingEntries.length === 0) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "workforce.code_test_passed",
        outcome: "success",
        entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: {
          stageId: ctx.stageId,
          totalTestFiles: entries.length,
          analyzedFiles: analyzedCount,
          newTestFiles: entries.filter((e) => e.changeKind === "added").length,
        },
      });
    } catch { /* best-effort */ }

    return {
      ok: true,
      summary: `Test integrity passed · analyzed ${analyzedCount}/${entries.length} test file(s), no cheating patterns detected.`,
      detail: {
        stageId: ctx.stageId,
        testSkipped: false,
        analyzedFiles: analyzedCount,
        totalTestFiles: entries.length,
        perFile: entries.map((e) => ({
          path: e.path,
          changeKind: e.changeKind,
          analyzed: e.analyzed,
          ok: e.ok,
          counts: e.counts ?? null,
          skipReason: e.skipReason ?? null,
        })),
      },
    };
  }

  const firstFail = failingEntries[0];
  const firstFinding = firstFail.findings[0]?.message ?? "test integrity issue";

  try {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorKind: "system",
      action: "workforce.code_test_failed",
      outcome: "failure",
      entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
      correlationId: idFactory.correlation(ctx.correlationId),
      source: "live",
      detail: {
        stageId: ctx.stageId,
        failingFileCount: failingEntries.length,
        findings: failingEntries.map((e) => ({
          path: e.path,
          changeKind: e.changeKind,
          findings: e.findings,
        })),
      },
    });
  } catch { /* best-effort */ }

  return {
    ok: false,
    error: `Test integrity failed: ${firstFail.path} · ${firstFinding} (and ${failingEntries.length - 1} other file(s))`,
    detail: {
      stageId: ctx.stageId,
      testSkipped: false,
      failingFileCount: failingEntries.length,
      perFile: entries.map((e) => ({
        path: e.path,
        changeKind: e.changeKind,
        analyzed: e.analyzed,
        ok: e.ok,
        findings: e.findings,
        counts: e.counts ?? null,
        skipReason: e.skipReason ?? null,
      })),
    },
  };
};
