/**
 * Pure tenant onboarding readiness checker.
 *
 * Walks a tenant's setup state and reports which onboarding milestones
 * are complete vs. pending, with a percentage and the next blocking
 * milestone. Used by /dashboard/onboarding to show "next step" without
 * the operator having to scroll through every doc.
 *
 * Pure / deterministic. No DB.
 */

export type MilestoneKey =
  | "cloud_connector_aws"
  | "cloud_connector_gcp"
  | "outbound_channel_slack"
  | "outbound_channel_teams"
  | "billing_plan_selected"
  | "first_proposal_decided"
  | "first_runbook_pinned"
  | "compliance_packet_generated"
  | "ai_provider_configured";

export interface MilestoneState {
  key: MilestoneKey;
  /** True iff the milestone is complete. */
  done: boolean;
  /** Tier required (only stricter tiers can ignore lower-tier milestones). */
  requiredForTiers?: ReadonlyArray<"trial" | "starter" | "growth" | "scale" | "enterprise">;
}

export interface OnboardingInput {
  tier: "trial" | "starter" | "growth" | "scale" | "enterprise";
  milestones: readonly MilestoneState[];
}

export interface MilestoneRow {
  key: MilestoneKey;
  done: boolean;
  required: boolean;
}

export interface OnboardingReport {
  rows: MilestoneRow[];
  totalRequired: number;
  completedRequired: number;
  /** 0..1 fraction of required milestones complete. */
  completion: number;
  /** Next required milestone that's not yet done, or null when ready. */
  nextBlocker: MilestoneKey | null;
  /** True iff every required milestone is complete. */
  ready: boolean;
}

const ALL_KEYS: MilestoneKey[] = [
  "cloud_connector_aws", "cloud_connector_gcp",
  "outbound_channel_slack", "outbound_channel_teams",
  "billing_plan_selected", "first_proposal_decided",
  "first_runbook_pinned", "compliance_packet_generated",
  "ai_provider_configured",
];

const DEFAULT_REQUIRED_FOR_TIER: Record<MilestoneKey, ReadonlyArray<OnboardingInput["tier"]>> = {
  cloud_connector_aws:         ["trial", "starter", "growth", "scale", "enterprise"],
  cloud_connector_gcp:         ["growth", "scale", "enterprise"],
  outbound_channel_slack:      ["starter", "growth", "scale", "enterprise"],
  outbound_channel_teams:      ["scale", "enterprise"],
  billing_plan_selected:       ["starter", "growth", "scale", "enterprise"],
  first_proposal_decided:      ["starter", "growth", "scale", "enterprise"],
  first_runbook_pinned:        ["growth", "scale", "enterprise"],
  compliance_packet_generated: ["scale", "enterprise"],
  ai_provider_configured:      ["trial", "starter", "growth", "scale", "enterprise"],
};

export function checkOnboardingReadiness(input: OnboardingInput): OnboardingReport {
  const byKey = new Map<MilestoneKey, MilestoneState>();
  for (const m of input.milestones) byKey.set(m.key, m);

  const rows: MilestoneRow[] = ALL_KEYS.map((key) => {
    const m = byKey.get(key);
    const requiredTiers = (m?.requiredForTiers ?? DEFAULT_REQUIRED_FOR_TIER[key]) as readonly string[];
    const required = requiredTiers.includes(input.tier);
    return { key, done: m?.done ?? false, required };
  });

  const requiredRows = rows.filter((r) => r.required);
  const completedRequired = requiredRows.filter((r) => r.done).length;
  const completion = requiredRows.length === 0 ? 1 : completedRequired / requiredRows.length;
  const blocker = requiredRows.find((r) => !r.done) ?? null;

  return {
    rows,
    totalRequired: requiredRows.length,
    completedRequired,
    completion,
    nextBlocker: blocker?.key ?? null,
    ready: completion >= 1,
  };
}
