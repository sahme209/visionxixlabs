/**
 * Live entitlement enforcer — Phase 384.
 *
 * DB-backed wrapper around checkEntitlement(). Resolves:
 *   1. The workspace's plan (via TenantBillingPlan → planForStripeTier).
 *   2. The current usage / count for the requested dimension.
 *
 * Then calls the pure gate and returns the decision. Fails open on
 * Prisma errors — entitlement enforcement is a soft check; downstream
 * gates + foreign keys still preserve correctness.
 *
 * Monthly-throughput dimensions read from UsageEvent counts; resource
 * dimensions read from the respective Prisma tables.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { readBillingPlan } from "./tenantBillingStore";
import { planForStripeTier } from "./planRegistry";
import {
  checkEntitlement,
  type EntitlementDimension,
  type EntitlementDecision,
} from "./checkEntitlement";

const periodStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/**
 * For monthly-throughput dimensions, the producer eventKind that the
 * counter sums. Resource dimensions return null (they're counted from
 * a dedicated Prisma table, not UsageEvent).
 */
const EVENT_KIND_FOR_DIMENSION: Partial<Record<EntitlementDimension, string>> = {
  agent_runs_per_month:        "agent_run",
  automation_runs_per_month:   "automation_run",
  connector_syncs_per_month:   "connector_sync",
  cloud_scans_per_month:       "cloud_scan",
  security_scans_per_month:    "security_scan",
  reports_per_month:           "report_generated",
  pdf_exports_per_month:       "pdf_export",
  monitoring_events_per_month: "monitoring_event",
};

async function countCurrentUsage(organizationId: string, dimension: EntitlementDimension): Promise<number> {
  const monthlyEventKind = EVENT_KIND_FOR_DIMENSION[dimension];
  if (monthlyEventKind) {
    try {
      const r = await prisma.usageEvent.count({
        where: {
          organizationId,
          eventKind: monthlyEventKind,
          createdAt: { gte: periodStart(new Date()) },
        },
      });
      return r;
    } catch {
      return 0;
    }
  }

  // Resource dimensions — count from the canonical Prisma table.
  try {
    switch (dimension) {
      case "users":
        // No platform User model with organizationId on tenant rows yet — best-effort 0.
        // When the per-org user join table lands, count it here.
        return 0;
      case "workspaces":
        // The organizationId IS the workspace in this codebase today. 1 unless
        // multi-workspace per org lands.
        return 1;
      case "connectors":
        // Connectors are spread across multiple tables today (CloudAccount,
        // future SaasConnectorAccount, future GithubConnection). For now we
        // approximate connector count = cloud accounts attached. Refines when
        // a unified Connector model lands.
        return await prisma.cloudAccount.count({ where: { organizationId } }).catch(() => 0);
      case "cloud_accounts":
        return await prisma.cloudAccount.count({ where: { organizationId } }).catch(() => 0);
      case "repositories":
        // No first-class Repository model yet; approximate via CodingTask's distinct repoRef.
        try {
          const distinct = await prisma.codingTask.findMany({
            where: { organizationId },
            distinct: ["repoRef"],
            select: { repoRef: true },
          });
          return distinct.length;
        } catch { return 0; }
      case "desktop_agents":
        // Desktop agent registry is its own follow-up. Return 0 until wired.
        return 0;
      case "agents_enabled":
        return await prisma.agentEngineerRecord.count({
          where: { organizationId, isEnabled: true },
        }).catch(() => 0);
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

export interface EnforceEntitlementInput {
  organizationId: string;
  dimension: EntitlementDimension;
  /** How many we want to add (default 1). */
  attemptedDelta?: number;
}

export async function enforceEntitlement(input: EnforceEntitlementInput): Promise<EntitlementDecision> {
  let plan;
  try {
    const billing = await readBillingPlan(input.organizationId);
    plan = planForStripeTier(billing.tier);
  } catch {
    plan = planForStripeTier("starter");
  }

  const currentUsage = await countCurrentUsage(input.organizationId, input.dimension);

  return checkEntitlement({
    plan,
    dimension: input.dimension,
    currentUsage,
    attemptedDelta: input.attemptedDelta ?? 1,
  });
}
