/**
 * Pure types module for tenant-freshness. No imports — safe to consume from
 * both client and server modules without dragging server-only deps (prisma,
 * next/server) into the client bundle analyzer.
 */

export interface TenantFreshnessSnapshot {
  hasConnectors: boolean;
  hasAgentRuns: boolean;
  hasApprovals: boolean;
  /** True when this tenant has zero connectors AND zero runs — first-login state. */
  freshTenant: boolean;
  counts: {
    cloudAccounts: number;
    agentRuns24h: number;
    busMessages24h: number;
    pendingApprovals: number;
  };
}
