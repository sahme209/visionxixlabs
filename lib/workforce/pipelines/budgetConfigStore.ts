/**
 * Budget-config IO boundary — Phase 401.
 *
 * Thin Prisma adapter around `OrganizationBudgetConfig`. Loads /
 * upserts / deletes the per-workspace cap. All validation lives in
 * pure kernels (resolveRunBudgetCap, validateBudgetConfigInput) so
 * this module stays a single-purpose I/O layer.
 *
 * Loads fail-soft: a Postgres outage returns null instead of
 * throwing, letting the runner fall back to the platform default.
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

/**
 * Load the per-workspace budget config. Returns null when no row
 * exists OR the lookup failed — both cases fall through to the
 * platform default by design.
 */
export async function loadBudgetConfig(organizationId: string): Promise<OrganizationBudgetConfigShape | null> {
  try {
    const row = await prisma.organizationBudgetConfig.findUnique({
      where: { organizationId },
      select: { defaultMaxCostCents: true, pipelineOverrides: true },
    });
    if (!row) return null;
    return {
      defaultMaxCostCents: row.defaultMaxCostCents,
      pipelineOverrides: normalizePipelineOverrides(row.pipelineOverrides),
    };
  } catch {
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
