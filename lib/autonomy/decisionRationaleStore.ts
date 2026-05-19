/**
 * Autonomous decision rationale store.
 *
 * Persists one durable audit row per autonomy candidate the loop
 * touches. The audit-readable spine of "why did the AGI do that?" —
 * inputs, per-stage reasoning, final outcome, all timestamped.
 *
 * Hard rules:
 *   - Best-effort writes. A DB failure must NEVER break the autonomy
 *     loop — callers wrap with `void`.
 *   - The full stages[] transcript is persisted (no truncation). The
 *     point of this table is to be the answer when someone asks
 *     "what happened on 2026-05-18?" three months later.
 *   - Read paths are tenant-scoped — cross-tenant reads return [].
 */

import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import type {
  AutonomyCandidate,
  AutonomyCycleReport,
  AutonomyMode,
} from "./autonomousLoopModel";

export interface DecisionRationaleRow {
  id: string;
  cycleId?: string | null;
  candidateId: string;
  title: string;
  charterMode: string;
  boundaryClass: string;
  outcome: string;
  haltedAtStage?: string | null;
  haltReason?: string | null;
  proposedIntent: string;
  stages: unknown;
  evidenceRefs: string[];
  durationMs: number;
  createdAt: string;
}

export interface DecisionRationaleReport {
  total: number;
  rows: DecisionRationaleRow[];
  perOutcome: Record<string, number>;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function recordCycleRationale(opts: {
  organizationId: string;
  report: AutonomyCycleReport;
  cycleId?: string;
}): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;
  const start = Date.now();
  const charterMode = opts.report.charter.mode;

  for (const c of opts.report.candidates) {
    try {
      await persistOne({
        organizationId: opts.organizationId,
        cycleId: opts.cycleId,
        candidate: c,
        charterMode,
        durationMs: Date.now() - start,
      });
      written++;
    } catch {
      failed++;
    }
  }
  return { written, failed };
}

async function persistOne(opts: {
  organizationId: string;
  cycleId?: string;
  candidate: AutonomyCandidate;
  charterMode: AutonomyMode;
  durationMs: number;
}): Promise<void> {
  const c = opts.candidate;
  const halted = c.stages.find((s) => s.status.startsWith("halted"));

  await prisma.autonomyDecisionRationale.create({
    data: {
      id: randomUUID(),
      organizationId: opts.organizationId,
      cycleId: opts.cycleId ?? null,
      candidateId: c.id,
      title: c.title.slice(0, 500),
      charterMode: opts.charterMode,
      boundaryClass: c.boundaryClass,
      outcome: c.outcome,
      haltedAtStage: halted?.stage ?? null,
      haltReason: (halted?.reason ?? halted?.summary ?? null)?.toString().slice(0, 1000) ?? null,
      proposedIntent: c.proposedIntent.slice(0, 1500),
      stages: c.stages as unknown as object,
      evidenceRefs: c.evidenceRefs.slice(0, 32),
      durationMs: opts.durationMs,
    },
  });
}

export async function readRationaleHistory(opts: {
  organizationId: string;
  limit?: number;
  outcome?: string;
}): Promise<DecisionRationaleReport> {
  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  try {
    const rows = await prisma.autonomyDecisionRationale.findMany({
      where: {
        organizationId: opts.organizationId,
        ...(opts.outcome ? { outcome: opts.outcome } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const perOutcome: Record<string, number> = {};
    for (const r of rows) {
      perOutcome[r.outcome] = (perOutcome[r.outcome] ?? 0) + 1;
    }
    return {
      total: rows.length,
      perOutcome,
      rows: rows.map((r) => ({
        id: r.id,
        cycleId: r.cycleId,
        candidateId: r.candidateId,
        title: r.title,
        charterMode: r.charterMode,
        boundaryClass: r.boundaryClass,
        outcome: r.outcome,
        haltedAtStage: r.haltedAtStage,
        haltReason: r.haltReason,
        proposedIntent: r.proposedIntent,
        stages: r.stages,
        evidenceRefs: r.evidenceRefs,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch {
    return { total: 0, rows: [], perOutcome: {} };
  }
}
