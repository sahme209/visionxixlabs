/**
 * Server-side tenant freshness helper.
 *
 * Server components (e.g. /dashboard/agents, /dashboard/automation) call
 * `getTenantFreshness()` to decide whether to render sample/demo arrays
 * or to show a calm empty-state. Client components use the parallel
 * `useTenantFreshness()` hook in components/platform/useTenantFreshness.
 *
 * Both share one definition of "fresh tenant": zero cloud accounts AND
 * zero agent runs in the last 24h.
 */

import { getLivePlatformSummary } from "@/lib/platform/livePlatformState";

export interface TenantFreshness {
  hasConnectors: boolean;
  hasAgentRuns: boolean;
  /** True when this tenant has zero connectors AND zero runs — first-login state. */
  freshTenant: boolean;
  counts: {
    cloudAccounts: number;
    agentRuns24h: number;
    busMessages24h: number;
    pendingApprovals: number;
  };
}

export async function getTenantFreshness(): Promise<TenantFreshness> {
  const summary = await getLivePlatformSummary();
  return {
    hasConnectors: summary.cloudAccounts > 0,
    hasAgentRuns: summary.agentRuns24h > 0 || summary.busMessages24h > 0,
    freshTenant: summary.cloudAccounts === 0 && summary.agentRuns24h === 0,
    counts: {
      cloudAccounts: summary.cloudAccounts,
      agentRuns24h: summary.agentRuns24h,
      busMessages24h: summary.busMessages24h,
      pendingApprovals: summary.pendingApprovals,
    },
  };
}
