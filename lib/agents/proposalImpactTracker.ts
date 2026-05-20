/**
 * Pure proposal-impact tracker.
 *
 * Snapshots the proposal lifecycle funnel and per-target activity, so
 * operators can see at a glance "how much are agents actually shipping
 * improvements?" — pending → approved → applied vs. rejected.
 *
 * Pure. No DB. Route handler does the read.
 */

import type { ProposalStatus, ProposalTarget } from "./methodProposalModel";

export interface RawImpactRow {
  target: ProposalTarget;
  status: ProposalStatus;
  /** ISO string of when status last moved (use updatedAt). */
  updatedAt: string;
}

export interface TargetImpact {
  target: ProposalTarget;
  pending: number;
  approved: number;
  applied: number;
  rejected: number;
  superseded: number;
  total: number;
  /** applied / (approved + rejected + applied) — share of decisions that shipped. */
  shipRate: number;
  /** approved / total — share of total that operators bless. */
  approvalRate: number;
  lastActivityAt: string | null;
}

export interface ImpactReport {
  totals: {
    pending: number;
    approved: number;
    applied: number;
    rejected: number;
    superseded: number;
    total: number;
  };
  /** Funnel: pending → approved → applied. */
  funnel: { pending: number; approved: number; applied: number };
  perTarget: TargetImpact[];
}

const ALL_TARGETS: ProposalTarget[] = [
  "runbook_recipe", "policy_template", "charter_default", "help_entry", "tier_cap",
];

const ZERO_TARGET = (target: ProposalTarget): TargetImpact => ({
  target, pending: 0, approved: 0, applied: 0, rejected: 0, superseded: 0,
  total: 0, shipRate: 0, approvalRate: 0, lastActivityAt: null,
});

export function buildImpactReport(rows: readonly RawImpactRow[]): ImpactReport {
  const totals = { pending: 0, approved: 0, applied: 0, rejected: 0, superseded: 0, total: 0 };
  const perTarget = new Map<ProposalTarget, TargetImpact>();
  for (const t of ALL_TARGETS) perTarget.set(t, ZERO_TARGET(t));

  for (const r of rows) {
    const t = perTarget.get(r.target);
    if (!t) continue;
    totals[r.status] += 1;
    totals.total += 1;
    t[r.status] += 1;
    t.total += 1;
    if (t.lastActivityAt === null || r.updatedAt > t.lastActivityAt) {
      t.lastActivityAt = r.updatedAt;
    }
  }

  for (const t of perTarget.values()) {
    const decided = t.approved + t.applied + t.rejected;
    t.shipRate = decided === 0 ? 0 : t.applied / decided;
    t.approvalRate = t.total === 0 ? 0 : t.approved / t.total;
  }

  return {
    totals,
    funnel: { pending: totals.pending, approved: totals.approved, applied: totals.applied },
    perTarget: ALL_TARGETS.map((t) => perTarget.get(t)!),
  };
}
