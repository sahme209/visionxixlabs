/**
 * Per-tenant autonomy charter store.
 *
 * Reads + writes the TenantAutonomyCharter row. When a row exists,
 * the scheduler and cockpit use the per-tenant charter instead of
 * the global default. The mode field is the canonical AutonomyMode
 * literal — anything outside the union is rejected at the API
 * boundary.
 *
 * Hard rules:
 *   - Validation at the boundary — only the four AutonomyMode
 *     literals are accepted.
 *   - perCycleActionLimit clamped to [1, 50] regardless of input.
 *   - Read paths are total: missing row returns the global default.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { charterForMode } from "./autonomyCharter";
import type { AutonomyCharter, AutonomyMode } from "./autonomousLoopModel";

const ALLOWED_MODES: AutonomyMode[] = ["observer", "review", "assisted", "autonomous"];

export interface TenantCharterRecord {
  organizationId: string;
  mode: AutonomyMode;
  perCycleActionLimit?: number;
  rationale?: string;
  slackWebhookOverride?: string;
  updatedAt: string;
  updatedBy?: string;
  /** Resolved charter (per-tenant overrides applied on top of the global default). */
  resolved: AutonomyCharter;
}

export async function readTenantCharter(organizationId: string): Promise<TenantCharterRecord | null> {
  try {
    const row = await prisma.tenantAutonomyCharter.findUnique({
      where: { organizationId },
    });
    if (!row) return null;
    const mode = isAutonomyMode(row.mode) ? row.mode : "observer";
    const base = charterForMode(mode);
    return {
      organizationId: row.organizationId,
      mode,
      perCycleActionLimit: row.perCycleActionLimit ?? undefined,
      rationale: row.rationale ?? undefined,
      slackWebhookOverride: row.slackWebhookOverride ?? undefined,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy ?? undefined,
      resolved: {
        ...base,
        perCycleActionLimit: row.perCycleActionLimit ?? base.perCycleActionLimit,
        rationale: row.rationale ?? base.rationale,
      },
    };
  } catch {
    return null;
  }
}

export interface UpsertTenantCharterInput {
  organizationId: string;
  mode: AutonomyMode;
  perCycleActionLimit?: number;
  rationale?: string;
  slackWebhookOverride?: string;
  updatedBy?: string;
}

export async function upsertTenantCharter(input: UpsertTenantCharterInput): Promise<TenantCharterRecord> {
  if (!isAutonomyMode(input.mode)) {
    throw new Error(`Invalid mode '${input.mode}'. Must be one of ${ALLOWED_MODES.join(" | ")}.`);
  }
  const cap = input.perCycleActionLimit !== undefined
    ? Math.max(1, Math.min(50, input.perCycleActionLimit))
    : undefined;

  const row = await prisma.tenantAutonomyCharter.upsert({
    where: { organizationId: input.organizationId },
    update: {
      mode: input.mode,
      perCycleActionLimit: cap,
      rationale: input.rationale?.slice(0, 1000) ?? null,
      slackWebhookOverride: input.slackWebhookOverride?.slice(0, 500) ?? null,
      updatedBy: input.updatedBy ?? null,
    },
    create: {
      organizationId: input.organizationId,
      mode: input.mode,
      perCycleActionLimit: cap,
      rationale: input.rationale?.slice(0, 1000) ?? null,
      slackWebhookOverride: input.slackWebhookOverride?.slice(0, 500) ?? null,
      updatedBy: input.updatedBy ?? null,
    },
  });
  const base = charterForMode(input.mode);
  return {
    organizationId: row.organizationId,
    mode: input.mode,
    perCycleActionLimit: row.perCycleActionLimit ?? undefined,
    rationale: row.rationale ?? undefined,
    slackWebhookOverride: row.slackWebhookOverride ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy ?? undefined,
    resolved: {
      ...base,
      perCycleActionLimit: row.perCycleActionLimit ?? base.perCycleActionLimit,
      rationale: row.rationale ?? base.rationale,
    },
  };
}

export async function deleteTenantCharter(organizationId: string): Promise<boolean> {
  try {
    await prisma.tenantAutonomyCharter.delete({ where: { organizationId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the charter to use for this tenant — per-tenant row when
 * present, else fall back to the global observer default.
 */
export async function resolveTenantCharter(organizationId: string): Promise<AutonomyCharter> {
  const row = await readTenantCharter(organizationId);
  return row?.resolved ?? charterForMode("observer");
}

function isAutonomyMode(v: string): v is AutonomyMode {
  return (ALLOWED_MODES as string[]).includes(v);
}
