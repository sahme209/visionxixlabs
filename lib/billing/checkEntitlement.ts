/**
 * Pure plan entitlement gate — Phase 384.
 *
 * Phase 381 declared every limit in PLAN_REGISTRY. Phase 382 enforced
 * AI credits via the pre-flight gate. This module enforces every
 * other limit: seats, workspaces, connectors, cloud accounts, repos,
 * desktop agents, agent runs / mo, automation runs / mo, connector
 * syncs / mo, cloud scans / mo, reports / mo, monitoring events / mo.
 *
 * Pure — no Prisma. Call sites pass (plan, dimension, currentUsage,
 * attemptedDelta=1) and receive an allow/block decision with the
 * threshold tone and the remaining budget. A live wrapper
 * (enforceEntitlement.ts) reads counts from DB and calls this.
 *
 * `null` on a limit means "Custom / Unlimited" (Enterprise) and
 * always allows. Numbers (including 0) are hard caps.
 */

import type { PricingPlan } from "./planRegistry";

export type EntitlementDimension =
  // Resource caps (hard counts)
  | "users"
  | "workspaces"
  | "connectors"
  | "cloud_accounts"
  | "repositories"
  | "desktop_agents"
  | "agents_enabled"
  // Monthly throughput caps
  | "agent_runs_per_month"
  | "automation_runs_per_month"
  | "connector_syncs_per_month"
  | "cloud_scans_per_month"
  | "security_scans_per_month"
  | "reports_per_month"
  | "pdf_exports_per_month"
  | "monitoring_events_per_month";

export type EntitlementThreshold = "below_70" | "warn_70" | "warn_90" | "exhausted";

export interface CheckEntitlementInput {
  plan: PricingPlan;
  dimension: EntitlementDimension;
  /** Current usage / current count of the dimension. */
  currentUsage: number;
  /** How many we want to add (default 1: creating one resource / consuming one run). */
  attemptedDelta?: number;
}

export interface EntitlementDecision {
  kind: "allow" | "block";
  reason: "entitlement_exhausted" | null;
  threshold: EntitlementThreshold;
  /** Remaining budget after the attempted delta, clamped at 0. */
  remaining: number;
  /** The limit being checked. null = custom/unlimited. */
  limit: number | null;
  dimension: EntitlementDimension;
}

/** Returns the configured limit for the given dimension on the plan. null = custom/unlimited. */
function limitFor(plan: PricingPlan, d: EntitlementDimension): number | null {
  const e = plan.entitlements;
  switch (d) {
    case "users":                       return e.maxUsers;
    case "workspaces":                  return e.maxWorkspaces;
    case "connectors":                  return e.maxConnectors;
    case "cloud_accounts":              return e.maxCloudAccounts;
    case "repositories":                return e.maxRepositories;
    case "desktop_agents":              return e.maxDesktopAgents;
    case "agents_enabled":              return e.maxAgentsEnabled;
    case "agent_runs_per_month":        return e.monthlyAgentRuns;
    case "automation_runs_per_month":   return e.monthlyAutomationRuns;
    case "connector_syncs_per_month":   return e.monthlyConnectorSyncs;
    case "cloud_scans_per_month":       return e.monthlyCloudScans;
    case "security_scans_per_month":    return e.monthlySecurityScans;
    case "reports_per_month":           return e.monthlyReports;
    case "pdf_exports_per_month":       return e.monthlyPdfExports;
    case "monitoring_events_per_month": return e.monitoringEventsPerMonth;
  }
}

export function checkEntitlement(input: CheckEntitlementInput): EntitlementDecision {
  const delta = Math.max(0, input.attemptedDelta ?? 1);
  const current = Math.max(0, input.currentUsage);
  const limit = limitFor(input.plan, input.dimension);

  // Custom / unlimited (Enterprise on most dimensions). Always allow.
  if (limit === null) {
    return {
      kind: "allow",
      reason: null,
      threshold: "below_70",
      remaining: Number.POSITIVE_INFINITY,
      limit: null,
      dimension: input.dimension,
    };
  }

  // Hard zero means the feature is disabled on this plan (e.g. desktop_agents on Starter).
  if (limit === 0) {
    return {
      kind: "block",
      reason: "entitlement_exhausted",
      threshold: "exhausted",
      remaining: 0,
      limit: 0,
      dimension: input.dimension,
    };
  }

  const projected = current + delta;
  const remaining = Math.max(0, limit - projected);
  const ratio = limit > 0 ? projected / limit : 0;

  let threshold: EntitlementThreshold;
  if (ratio > 1)         threshold = "exhausted";
  else if (ratio >= 0.9) threshold = "warn_90";
  else if (ratio >= 0.7) threshold = "warn_70";
  else                   threshold = "below_70";

  // Block when the attempt would exceed the cap. Note: at exactly the cap
  // (projected === limit), we allow — this is the boundary case where the
  // operator hits the limit cleanly on the last attempt.
  if (projected > limit) {
    return {
      kind: "block",
      reason: "entitlement_exhausted",
      threshold: "exhausted",
      remaining: 0,
      limit,
      dimension: input.dimension,
    };
  }

  return {
    kind: "allow",
    reason: null,
    threshold,
    remaining,
    limit,
    dimension: input.dimension,
  };
}
