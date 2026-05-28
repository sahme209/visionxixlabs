/**
 * Phase 507 — PolicyProposalInputs aggregator.
 *
 * Gathers org-level aggregates the engine needs. Each count uses
 * safe-degradation so a partially-migrated DB still produces a
 * usable proposal set.
 */

import { isMissingTable } from "./releaseListResponder";
import type { PolicyProposalInputs } from "./policyProposalEngine";

export interface PolicyProposalRepo {
  release: {
    count(args: { where: { organizationId: string } }): Promise<number>;
    findMany(args: {
      where: { organizationId: string };
      orderBy: { createdAt: "desc" };
      take?: number;
      select?: Record<string, boolean>;
    }): Promise<Array<{ id: string; applicationId: string; createdAt: Date }>>;
  };
  releaseReadinessSnapshot: {
    count(args: { where: { organizationId: string; rollbackReadiness: { lt: number } } }): Promise<number>;
  };
  deploymentIncident: {
    count(args: { where: { organizationId: string; status: "open"; severity: "critical" } }): Promise<number>;
  };
  manualFix: {
    count(args: { where: { organizationId: string; status: "pending"; environmentTier: "prod" } }): Promise<number>;
  };
  releaseEvidencePack: {
    count(args: { where: { organizationId: string; signedAt: { not: null } } }): Promise<number>;
  };
  releaseNotesDraft: {
    count(args: { where: { organizationId: string; status: "published" } }): Promise<number>;
  };
  branchProtectionSnapshot: {
    count(args: { where: { organizationId: string; branchName: "main"; strength: { in: string[] } } }): Promise<number>;
    findMany(args: {
      where: { organizationId: string; branchName: "main" };
      select: { allowsForcePushes: boolean };
    }): Promise<Array<{ allowsForcePushes: boolean }>>;
  };
  changeTicket: {
    count(args: { where: { organizationId: string } }): Promise<number>;
  };
  policyRule: {
    findMany(args: { where: { organizationId: string; enabled: true }; select: { key: boolean } }): Promise<Array<{ key: string }>>;
  };
  policyProposal: {
    findMany(args: { where: { organizationId: string; operatorDecision: "pending" }; select: { suggestedRuleKey: boolean } }): Promise<Array<{ suggestedRuleKey: string }>>;
  };
}

const WINDOW_RELEASES = 20;

export async function aggregatePolicyProposalInputs(
  repo: PolicyProposalRepo,
  organizationId: string,
  opts: { now?: Date } = {},
): Promise<PolicyProposalInputs> {
  const now = opts.now ?? new Date();

  // Most recent N releases to scope the analysis window.
  const recent = await safe(() =>
    repo.release.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: WINDOW_RELEASES,
    }),
    [] as Array<{ id: string; applicationId: string; createdAt: Date }>,
  );

  const releasesAnalyzed = recent.length;

  // For brevity, we use org-wide counts as proxies for "in window".
  // A future phase can scope tighter via per-release joins.
  const [
    weakRollback,
    openCritical,
    pendingProdFixes,
    signedEvidence,
    publishedNotes,
    weakMain,
    mainProtections,
    totalChangeTickets,
    activeRules,
    pendingProposals,
  ] = await Promise.all([
    safeCount(() => repo.releaseReadinessSnapshot.count({ where: { organizationId, rollbackReadiness: { lt: 60 } } })),
    safeCount(() => repo.deploymentIncident.count({ where: { organizationId, status: "open", severity: "critical" } })),
    safeCount(() => repo.manualFix.count({ where: { organizationId, status: "pending", environmentTier: "prod" } })),
    safeCount(() => repo.releaseEvidencePack.count({ where: { organizationId, signedAt: { not: null } } })),
    safeCount(() => repo.releaseNotesDraft.count({ where: { organizationId, status: "published" } })),
    safeCount(() => repo.branchProtectionSnapshot.count({ where: { organizationId, branchName: "main", strength: { in: ["weak", "none"] } } })),
    safe(() => repo.branchProtectionSnapshot.findMany({ where: { organizationId, branchName: "main" }, select: { allowsForcePushes: true } }), [] as Array<{ allowsForcePushes: boolean }>),
    safeCount(() => repo.changeTicket.count({ where: { organizationId } })),
    safe(() => repo.policyRule.findMany({ where: { organizationId, enabled: true }, select: { key: true } }), [] as Array<{ key: string }>),
    safe(() => repo.policyProposal.findMany({ where: { organizationId, operatorDecision: "pending" }, select: { suggestedRuleKey: true } }), [] as Array<{ suggestedRuleKey: string }>),
  ]);

  const forcePushAllowedMainRepos = mainProtections.filter((p) => p.allowsForcePushes).length;

  // Estimate ratios — "release count without X" approximated as
  // releasesAnalyzed - count-of-X (clamped to ≥ 0). Conservative
  // because we're org-wide rather than per-release-joined.
  const releasesWithoutEvidencePack = Math.max(0, releasesAnalyzed - signedEvidence);
  const releasesWithoutReleaseNotes = Math.max(0, releasesAnalyzed - publishedNotes);
  const releasesWithoutChangeTicket = Math.max(0, releasesAnalyzed - totalChangeTickets);
  // For unreconciled manual fix and weak rollback readiness, we treat
  // each pending row as ≥ 1 release affected (upper bound).
  const releasesWithUnreconciledManualFix = Math.min(releasesAnalyzed, pendingProdFixes);
  const releasesWithWeakRollbackReadiness = Math.min(releasesAnalyzed, weakRollback);
  const releasesWithOpenCriticalIncident = Math.min(releasesAnalyzed, openCritical);

  return {
    releasesAnalyzed,
    releasesWithOpenCriticalIncident,
    releasesWithWeakRollbackReadiness,
    releasesWithoutEvidencePack,
    releasesWithUnreconciledManualFix,
    releasesWithoutReleaseNotes,
    weakProtectionMainRepos: weakMain,
    forcePushAllowedMainRepos,
    releasesWithoutChangeTicket,
    existingActiveRuleKeys: activeRules.map((r) => r.key),
    pendingProposalKeys: pendingProposals.map((p) => p.suggestedRuleKey),
    now,
  };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return fallback; throw err; }
}

async function safeCount(fn: () => Promise<number>): Promise<number> {
  return safe(fn, 0);
}
