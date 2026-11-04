/**
 * Budget-config IO boundary — Phase 401.
 *
 * Thin Prisma adapter around `OrganizationBudgetConfig`. Loads /
 * upserts / deletes the per-workspace cap. All validation lives in
 * pure kernels (resolveRunBudgetCap, validateBudgetConfigInput) so
 * this module stays a single-purpose I/O layer.
 *
 * Display callers retain the optional fail-soft read. Execution callers
 * request a strict read so an outage cannot authorize default spending.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { OrganizationBudgetConfigShape } from "./resolveRunBudgetCap";

interface PipelineOverrideRow {
  pipelineId: string;
  maxCostCents: number | null;
}

function normalizePipelineOverrides(raw: unknown): PipelineOverrideRow[] {
  if (!Array.isArray(raw)) return [];
  const out: PipelineOverrideRow[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.pipelineId !== "string" || r.pipelineId.length === 0) continue;
    if (seen.has(r.pipelineId)) continue;
    if (r.maxCostCents === null) {
      out.push({ pipelineId: r.pipelineId, maxCostCents: null });
      seen.add(r.pipelineId);
    } else if (typeof r.maxCostCents === "number" && Number.isFinite(r.maxCostCents) && r.maxCostCents > 0) {
      out.push({ pipelineId: r.pipelineId, maxCostCents: Math.floor(r.maxCostCents) });
      seen.add(r.pipelineId);
    }
  }
  return out;
}

/** Execution must distinguish malformed policy from a verified absent override. */
export function assertStoredBudgetConfig(row: { defaultMaxCostCents: unknown; pipelineOverrides: unknown }): void {
  const validCap = (value: unknown) => value === null || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
  if (!validCap(row.defaultMaxCostCents) || !Array.isArray(row.pipelineOverrides)) throw new Error("budget_config_invalid");
  const seen = new Set<string>();
  for (const raw of row.pipelineOverrides) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("budget_config_invalid");
    const entry = raw as Record<string, unknown>;
    if (typeof entry.pipelineId !== "string" || entry.pipelineId.length === 0 || seen.has(entry.pipelineId) || !validCap(entry.maxCostCents)) {
      throw new Error("budget_config_invalid");
    }
    seen.add(entry.pipelineId);
  }
}

/**
 * Load the per-workspace budget config. A verified absent row returns null.
 * With failClosedOnReadError, lookup failures propagate to the execution gate;
 * legacy display callers may still receive null on a failed lookup.
 */
export async function loadBudgetConfig(organizationId: string, options?: { failClosedOnReadError?: boolean }): Promise<OrganizationBudgetConfigShape | null> {
  try {
    const row = await prisma.organizationBudgetConfig.findUnique({
      where: { organizationId },
      select: { defaultMaxCostCents: true, pipelineOverrides: true },
    });
    if (!row) return null;
    if (options?.failClosedOnReadError) assertStoredBudgetConfig(row);
    return {
      defaultMaxCostCents: row.defaultMaxCostCents,
      pipelineOverrides: normalizePipelineOverrides(row.pipelineOverrides),
    };
  } catch (error) {
    if (options?.failClosedOnReadError) throw error;
    return null;
  }
}

export interface UpsertBudgetConfigInput {
  organizationId: string;
  defaultMaxCostCents: number | null;
  pipelineOverrides: ReadonlyArray<PipelineOverrideRow>;
  rationale?: string | null;
  updatedBy: string;
  correlationId: string;
}

export async function upsertBudgetConfig(
  input: UpsertBudgetConfigInput,
): Promise<{ ok: true; created: boolean }> {
  const normalized = normalizePipelineOverrides(input.pipelineOverrides);

  const data = {
    defaultMaxCostCents: input.defaultMaxCostCents,
    pipelineOverrides: normalized as unknown as object,
    rationale: input.rationale ?? null,
    updatedBy: input.updatedBy,
  };

  const before = await prisma.organizationBudgetConfig.findUnique({
    where: { organizationId: input.organizationId },
    select: { organizationId: true },
  });

  await prisma.organizationBudgetConfig.upsert({
    where: { organizationId: input.organizationId },
    update: data,
    create: { organizationId: input.organizationId, ...data },
  });

  try {
    await recordAudit({
      organizationId: idFactory.organization(input.organizationId),
      actorKind: "system",
      action: before ? "workforce.budget_config_updated" : "workforce.budget_config_created",
      outcome: "success",
      entityRef: `budget_config:${input.organizationId}`,
      correlationId: idFactory.correlation(input.correlationId),
      source: "live",
      detail: {
        defaultMaxCostCents: input.defaultMaxCostCents,
        pipelineOverrides: normalized,
        rationale: input.rationale ?? null,
        updatedBy: input.updatedBy,
      },
    });
  } catch { /* best-effort */ }

  return { ok: true, created: !before };
}

export async function deleteBudgetConfig(args: {
  organizationId: string;
  deletedBy: string;
  correlationId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const removed = await prisma.organizationBudgetConfig.deleteMany({
    where: { organizationId: args.organizationId },
  });
  if (removed.count === 0) {
    return { ok: false, reason: "config_not_found" };
  }
  try {
    await recordAudit({
      organizationId: idFactory.organization(args.organizationId),
      actorKind: "system",
      action: "workforce.budget_config_deleted",
      outcome: "success",
      entityRef: `budget_config:${args.organizationId}`,
      correlationId: idFactory.correlation(args.correlationId),
      source: "live",
      detail: { deletedBy: args.deletedBy },
    });
  } catch { /* best-effort */ }
  return { ok: true };
}
