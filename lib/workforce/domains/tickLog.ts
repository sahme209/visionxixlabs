/**
 * Workforce domain tick log — Phase 622.
 *
 * Persists a per-workspace summary of every domain sweep (cron tick
 * or operator-triggered manual sweep). Replaces the "infer health
 * from freshest row updatedAt" pattern with a real source of truth.
 *
 * Persisted as a synthetic AiRationaleEnrichment row at
 * targetKind = "workforce_domain_tick", targetId = workspaceId.
 * One row per workspace, overwritten on each tick.
 *
 * Why piggyback on AiRationaleEnrichment instead of a new model:
 *  · No Prisma migration risk
 *  · Existing query/auth scaffolding already covers it
 *  · The narrative + nextActionsJson shape fits naturally
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const WORKFORCE_TICK_TARGET_KIND = "workforce_domain_tick";

export type TickTrigger = "cron" | "manual";

export interface TickSummary {
  trigger: TickTrigger;
  picked: number;
  skippedDisabled: number;
  aiGenerated: number;
  fallbackRules: number;
  error: number;
  durationMs: number;
  /** Most recent engineer ids that ran in this tick, in priority order. */
  engineerIds: ReadonlyArray<string>;
}

export interface TickReadback {
  trigger: TickTrigger;
  picked: number;
  skippedDisabled: number;
  aiGenerated: number;
  fallbackRules: number;
  error: number;
  durationMs: number;
  engineerIds: ReadonlyArray<string>;
  updatedAt: Date;
  narrative: string;
}

function buildNarrative(s: TickSummary): string {
  if (s.picked === 0) {
    return `Workforce domain sweep (${s.trigger}) ran but picked 0 engineers — either all engineers are disabled or the workspace has no fresh signal yet.`;
  }
  const ok = s.aiGenerated;
  const fb = s.fallbackRules;
  const err = s.error;
  return `Workforce domain sweep (${s.trigger}) ran ${s.picked} engineer${s.picked === 1 ? "" : "s"} in ${s.durationMs}ms · ${ok} ai_generated · ${fb} fallback_rules · ${err} error${err === 1 ? "" : "s"}${s.skippedDisabled > 0 ? ` · ${s.skippedDisabled} skipped (disabled)` : ""}.`;
}

function buildPayload(s: TickSummary): string[] {
  const payload: string[] = [
    `trigger|${s.trigger}`,
    `picked|${s.picked}`,
    `ai_generated|${s.aiGenerated}`,
    `fallback_rules|${s.fallbackRules}`,
    `error|${s.error}`,
    `skipped_disabled|${s.skippedDisabled}`,
    `duration_ms|${s.durationMs}`,
  ];
  for (const id of s.engineerIds) payload.push(`engineer|${id}`);
  return payload;
}

export async function persistTickSummary(
  organizationId: string,
  summary: TickSummary,
): Promise<void> {
  const narrative = buildNarrative(summary);
  const payload = buildPayload(summary);
  const outcome =
    summary.error > 0 && summary.error >= summary.picked / 2 ? "error"
    : summary.aiGenerated > 0 ? "ai_generated"
    : "fallback_rules";
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: WORKFORCE_TICK_TARGET_KIND,
          targetId: organizationId,
        },
      },
      create: {
        organizationId,
        targetKind: WORKFORCE_TICK_TARGET_KIND,
        targetId: organizationId,
        narrative,
        riskFactorsJson: [] as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome,
        errorMessage: summary.error > 0 ? `${summary.error} engineer failures` : null,
        modelHint: null,
        engineVersion: "workforce-tick-v1",
      },
      update: {
        narrative,
        nextActionsJson: payload as unknown as string[],
        outcome,
        errorMessage: summary.error > 0 ? `${summary.error} engineer failures` : null,
      },
    });
  } catch (err) {
    console.warn(
      "[tickLog] persist failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function readTickSummary(
  organizationId: string,
): Promise<TickReadback | null> {
  try {
    const row = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: WORKFORCE_TICK_TARGET_KIND,
          targetId: organizationId,
        },
      },
      select: { narrative: true, nextActionsJson: true, updatedAt: true },
    });
    if (!row) return null;
    const tags = new Map<string, string>();
    const engineerIds: string[] = [];
    if (Array.isArray(row.nextActionsJson)) {
      for (const e of row.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        const idx = e.indexOf("|");
        if (idx === -1) continue;
        const key = e.slice(0, idx);
        const val = e.slice(idx + 1);
        if (key === "engineer") engineerIds.push(val);
        else tags.set(key, val);
      }
    }
    const triggerRaw = tags.get("trigger");
    const trigger: TickTrigger = triggerRaw === "manual" ? "manual" : "cron";
    const num = (k: string) => {
      const v = tags.get(k);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : 0;
    };
    return {
      trigger,
      picked: num("picked"),
      skippedDisabled: num("skipped_disabled"),
      aiGenerated: num("ai_generated"),
      fallbackRules: num("fallback_rules"),
      error: num("error"),
      durationMs: num("duration_ms"),
      engineerIds,
      updatedAt: row.updatedAt,
      narrative: row.narrative,
    };
  } catch {
    return null;
  }
}
