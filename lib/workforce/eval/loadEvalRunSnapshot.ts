/**
 * EvalRun ↔ EvalRunSnapshot adapter — Phase 393.
 *
 * Thin Prisma layer that loads either the most recent completed
 * EvalRun + all its cases, or a specific run by id, and returns the
 * pure-kernel shape the comparator + release-gate operate on. Keeps
 * I/O at the boundary so the pure logic stays test-isolated.
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { EvalRunSnapshot, EvalCaseSnapshot } from "./compareEvalRuns";

interface EvalCaseRow {
  taskKey: string;
  outcome: string;
  score: number;
}

interface EvalRunRow {
  id: string;
  startedAt: Date;
  passCount: number;
  failCount: number;
  skippedCount: number;
  totalCases: number;
  totalCostCents: number;
  cases: EvalCaseRow[];
}

function toCaseSnapshot(row: EvalCaseRow): EvalCaseSnapshot {
  const outcome: EvalCaseSnapshot["outcome"] =
    row.outcome === "pass"    ? "pass" :
    row.outcome === "fail"    ? "fail" :
    row.outcome === "errored" ? "errored" :
    "skipped";
  return {
    taskKey: row.taskKey,
    outcome,
    score: row.score,
  };
}

function toRunSnapshot(row: EvalRunRow): EvalRunSnapshot {
  return {
    runId: row.id,
    startedAt: row.startedAt,
    passCount: row.passCount,
    failCount: row.failCount,
    skippedCount: row.skippedCount,
    totalCases: row.totalCases,
    totalCostCents: row.totalCostCents,
    cases: row.cases.map(toCaseSnapshot),
  };
}

/**
 * Load a specific EvalRun by id (plus all cases) and return the
 * pure-kernel snapshot. Returns null when no row matches.
 */
export async function loadEvalRunSnapshot(runId: string): Promise<EvalRunSnapshot | null> {
  const row = await prisma.evalRun.findUnique({
    where: { id: runId },
    include: {
      cases: {
        select: { taskKey: true, outcome: true, score: true },
      },
    },
  });
  if (!row) return null;
  return toRunSnapshot(row as EvalRunRow);
}

/**
 * Load the most recent *completed* EvalRun strictly before a given timestamp.
 * Returns null when nothing exists yet (Day 1 — comparator must handle null).
 *
 * Passing `excludeRunId` lets the caller skip the in-flight run (the one
 * we're about to compare *against* its predecessor).
 */
export async function findPreviousCompletedRun(
  before: Date,
  excludeRunId?: string,
): Promise<EvalRunSnapshot | null> {
  const row = await prisma.evalRun.findFirst({
    where: {
      status: "completed",
      startedAt: { lt: before },
      ...(excludeRunId ? { id: { not: excludeRunId } } : {}),
    },
    orderBy: { startedAt: "desc" },
    include: {
      cases: {
        select: { taskKey: true, outcome: true, score: true },
      },
    },
  });
  if (!row) return null;
  return toRunSnapshot(row as EvalRunRow);
}

/**
 * Load the most recent EvalRun overall (any status). Used by the
 * admin /api/admin/eval/release-gate route to show "what's the
 * gate decision right now?"
 */
export async function findLatestEvalRun(): Promise<EvalRunSnapshot | null> {
  const row = await prisma.evalRun.findFirst({
    orderBy: { startedAt: "desc" },
    include: {
      cases: {
        select: { taskKey: true, outcome: true, score: true },
      },
    },
  });
  if (!row) return null;
  return toRunSnapshot(row as EvalRunRow);
}

/**
 * Same as findLatestEvalRun but also returns the raw status — the
 * release-gate kernel needs runStatus separately so it can flag
 * incomplete runs as their own blocker.
 */
export async function findLatestEvalRunWithStatus(): Promise<{ snapshot: EvalRunSnapshot; status: string } | null> {
  const row = await prisma.evalRun.findFirst({
    orderBy: { startedAt: "desc" },
    include: {
      cases: {
        select: { taskKey: true, outcome: true, score: true },
      },
    },
  });
  if (!row) return null;
  return {
    snapshot: toRunSnapshot(row as EvalRunRow),
    status: (row as { status: string }).status,
  };
}
