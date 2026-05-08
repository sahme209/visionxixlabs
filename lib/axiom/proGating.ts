import type { PlanEntitlements, OperatorTier } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Axiom feature catalog — every gated capability in one place
// ---------------------------------------------------------------------------

export type AxiomFeature =
  | "full_findings"
  | "full_execution_plan"
  | "terraform_export"
  | "approval_center"
  | "scheduled_runs"
  | "safe_apply"
  | "rollback_logs"
  | "multi_cloud"
  | "explain_engine"
  | "diff_engine"
  | "autopilot_modes";

export type GateResult = {
  allowed: boolean;
  reason: string | null;
  upgradeMessage: string | null;
  requiredTier: OperatorTier;
};

// ---------------------------------------------------------------------------
// Feature → minimum tier mapping
// ---------------------------------------------------------------------------

const FEATURE_TIERS: Record<AxiomFeature, OperatorTier> = {
  full_findings: "pro",
  full_execution_plan: "pro",
  terraform_export: "pro",
  approval_center: "growth",
  scheduled_runs: "growth",
  safe_apply: "growth",
  rollback_logs: "growth",
  multi_cloud: "growth",
  explain_engine: "pro",
  diff_engine: "growth",
  autopilot_modes: "growth",
};

const TIER_RANK: Record<OperatorTier, number> = {
  free: 0,
  pro: 1,
  growth: 2,
  enterprise: 3,
};

// ---------------------------------------------------------------------------
// checkFeatureAccess — the single gating function
// ---------------------------------------------------------------------------

export function checkFeatureAccess(
  entitlements: PlanEntitlements,
  feature: AxiomFeature,
): GateResult {
  const requiredTier = FEATURE_TIERS[feature];
  const userRank = TIER_RANK[entitlements.operatorTier];
  const requiredRank = TIER_RANK[requiredTier];

  if (userRank >= requiredRank) {
    return { allowed: true, reason: null, upgradeMessage: null, requiredTier };
  }

  const copy = UPGRADE_COPY[feature];

  return {
    allowed: false,
    reason: copy.reason,
    upgradeMessage: copy.upgradeMessage,
    requiredTier,
  };
}

export function checkMultipleFeatures(
  entitlements: PlanEntitlements,
  features: AxiomFeature[],
): Record<AxiomFeature, GateResult> {
  const results: Partial<Record<AxiomFeature, GateResult>> = {};
  for (const f of features) {
    results[f] = checkFeatureAccess(entitlements, f);
  }
  return results as Record<AxiomFeature, GateResult>;
}

// ---------------------------------------------------------------------------
// Free-tier preview limits
// ---------------------------------------------------------------------------

export const FREE_LIMITS = {
  maxFindings: 3,
  maxExecutionPlanItems: 1,
  showSavingsPreview: true,
  showRiskSummary: true,
  showFullSavingsBreakdown: false,
  showTerraformExport: false,
  showApprovalCenter: false,
  showScheduledRuns: false,
  showApplyButton: false,
  showRollbackLogs: false,
  showExplainEngine: false,
  maxCloudAccounts: 1,
} as const;

// ---------------------------------------------------------------------------
// applyFreePreview — truncate agent results for free users
//
// Returns a modified result with preview data and upgrade prompts.
// Never hides the fact that more data exists.
// ---------------------------------------------------------------------------

export type PreviewResult = {
  findings: unknown[];
  totalFindingsCount: number;
  hiddenFindingsCount: number;
  executionPlanPreview: unknown | null;
  totalPlanItemsCount: number;
  savingsPreview: {
    monthlyLow: number;
    monthlyHigh: number;
    yearlyLow: number;
    yearlyHigh: number;
  } | null;
  riskSummary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  } | null;
  upgradePrompts: UpgradePrompt[];
  gatedFeatures: Record<AxiomFeature, GateResult>;
};

export type UpgradePrompt = {
  feature: AxiomFeature;
  placement: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  requiredTier: OperatorTier;
};

export function applyFreePreview(
  fullFindings: unknown[],
  fullPlanItems: unknown[],
  savingsEstimate: { monthlyLow: number; monthlyHigh: number; yearlyLow: number; yearlyHigh: number } | null,
  riskCounts: { low: number; medium: number; high: number; critical: number } | null,
  entitlements: PlanEntitlements,
): PreviewResult {
  const gated = checkMultipleFeatures(entitlements, ALL_FEATURES);

  if (gated.full_findings.allowed) {
    return {
      findings: fullFindings,
      totalFindingsCount: fullFindings.length,
      hiddenFindingsCount: 0,
      executionPlanPreview: fullPlanItems.length > 0 ? fullPlanItems : null,
      totalPlanItemsCount: fullPlanItems.length,
      savingsPreview: savingsEstimate,
      riskSummary: riskCounts,
      upgradePrompts: [],
      gatedFeatures: gated,
    };
  }

  const visibleFindings = fullFindings.slice(0, FREE_LIMITS.maxFindings);
  const hiddenCount = Math.max(0, fullFindings.length - FREE_LIMITS.maxFindings);
  const planPreview = fullPlanItems.length > 0 ? fullPlanItems.slice(0, FREE_LIMITS.maxExecutionPlanItems) : null;

  const prompts: UpgradePrompt[] = [];

  if (hiddenCount > 0) {
    prompts.push({
      feature: "full_findings",
      placement: "findings_list",
      headline: `${hiddenCount} more finding${hiddenCount === 1 ? "" : "s"} available`,
      body: `Your scan found ${fullFindings.length} optimization opportunities. Upgrade to see the full list with detailed recommendations.`,
      ctaLabel: "Unlock all findings",
      ctaUrl: "/pricing?ref=axiom-findings",
      requiredTier: "pro",
    });
  }

  if (fullPlanItems.length > FREE_LIMITS.maxExecutionPlanItems) {
    prompts.push({
      feature: "full_execution_plan",
      placement: "execution_plan",
      headline: "Full execution plan available",
      body: `Your agent generated ${fullPlanItems.length} action${fullPlanItems.length === 1 ? "" : "s"}. Upgrade to see the complete plan with step-by-step instructions.`,
      ctaLabel: "See full plan",
      ctaUrl: "/pricing?ref=axiom-plan",
      requiredTier: "pro",
    });
  }

  if (!gated.terraform_export.allowed && fullPlanItems.length > 0) {
    prompts.push({
      feature: "terraform_export",
      placement: "export_section",
      headline: "Terraform & CLI exports",
      body: "Export your execution plan as Terraform configs, CLI scripts, or JSON — ready to apply in your infrastructure pipeline.",
      ctaLabel: "Unlock exports",
      ctaUrl: "/pricing?ref=axiom-terraform",
      requiredTier: "pro",
    });
  }

  if (!gated.safe_apply.allowed && fullPlanItems.length > 0) {
    prompts.push({
      feature: "safe_apply",
      placement: "apply_section",
      headline: "Apply changes safely",
      body: "Let the agent apply approved changes with prechecks, dry runs, and automatic rollback. Every action is logged and reversible.",
      ctaLabel: "Unlock safe apply",
      ctaUrl: "/pricing?ref=axiom-apply",
      requiredTier: "growth",
    });
  }

  if (!gated.scheduled_runs.allowed) {
    prompts.push({
      feature: "scheduled_runs",
      placement: "schedule_section",
      headline: "Scheduled agent scans",
      body: "Set the agent to scan daily or weekly. Get notified when costs drift, new risks appear, or savings opportunities increase.",
      ctaLabel: "Unlock scheduling",
      ctaUrl: "/pricing?ref=axiom-schedule",
      requiredTier: "growth",
    });
  }

  return {
    findings: visibleFindings,
    totalFindingsCount: fullFindings.length,
    hiddenFindingsCount: hiddenCount,
    executionPlanPreview: planPreview,
    totalPlanItemsCount: fullPlanItems.length,
    savingsPreview: savingsEstimate,
    riskSummary: riskCounts,
    upgradePrompts: prompts,
    gatedFeatures: gated,
  };
}

// ---------------------------------------------------------------------------
// Upgrade copy — honest, clear, no dark patterns
//
// Every message explains what the feature does and why it's gated.
// No urgency pressure, no FOMO, no fake scarcity.
// ---------------------------------------------------------------------------

const UPGRADE_COPY: Record<AxiomFeature, { reason: string; upgradeMessage: string }> = {
  full_findings: {
    reason: "Free accounts see a preview of the top 3 findings. The full list is available on Growth and above.",
    upgradeMessage: "Upgrade to see all findings from your cloud scan, with detailed savings breakdowns and prioritized recommendations.",
  },
  full_execution_plan: {
    reason: "Free accounts see one sample action from the execution plan.",
    upgradeMessage: "Upgrade to see the complete execution plan — every recommended change, with risk levels, savings estimates, and step-by-step instructions.",
  },
  terraform_export: {
    reason: "Terraform, CLI, and JSON exports are available on Growth plans and above.",
    upgradeMessage: "Export your execution plan as ready-to-use Terraform configs, AWS/Azure/GCP CLI commands, or structured JSON for your CI/CD pipeline.",
  },
  approval_center: {
    reason: "The approval center — where you review, approve, or reject each agent action — requires a Scale plan.",
    upgradeMessage: "Get per-item approval controls with risk assessment, savings impact, and one-click approve/reject/snooze for every recommended change.",
  },
  scheduled_runs: {
    reason: "Automated scheduled scans require a Scale plan.",
    upgradeMessage: "Schedule daily or weekly agent scans to catch cost drift, new risks, and savings opportunities automatically. Get notified when things change.",
  },
  safe_apply: {
    reason: "Applying changes through the agent requires a Scale plan with execution capabilities.",
    upgradeMessage: "Let the agent apply approved changes with prechecks, dry-run simulation, and automatic rollback if anything goes wrong. Every action is logged.",
  },
  rollback_logs: {
    reason: "Rollback logs and audit trails require a Scale plan.",
    upgradeMessage: "Full audit trail of every action the agent takes — what changed, when, by whom, and how to reverse it. Includes automated rollback controls.",
  },
  multi_cloud: {
    reason: "Multi-cloud scanning (AWS + Azure + GCP in one account) requires a Scale plan.",
    upgradeMessage: "Connect all your cloud accounts — AWS, Azure, and GCP — and scan them in a single unified view with cross-cloud optimization recommendations.",
  },
  explain_engine: {
    reason: "The Explain This feature — asking the agent why it recommended something — is available on Growth and above.",
    upgradeMessage: "Ask the agent about any finding: why it was recommended, what evidence was used, what happens if you ignore it, and whether it's safe to apply.",
  },
  diff_engine: {
    reason: "Scan-over-scan comparison requires a Scale plan.",
    upgradeMessage: "Compare any two agent scans to see what changed — new resources, resolved findings, cost drift, and risk trends over time.",
  },
  autopilot_modes: {
    reason: "Autopilot modes (Observe, Recommend, Assisted Apply, Full Guarded) require a Scale plan.",
    upgradeMessage: "Control how autonomous the agent is per cloud account — from observation-only to fully guarded autopilot with automatic safe-apply.",
  },
};

// ---------------------------------------------------------------------------
// Feature metadata for UI rendering
// ---------------------------------------------------------------------------

export type FeatureInfo = {
  key: AxiomFeature;
  label: string;
  description: string;
  tier: OperatorTier;
  tierLabel: string;
  icon: string;
};

const TIER_LABELS: Record<OperatorTier, string> = {
  free: "Starter",
  pro: "Growth",
  growth: "Scale",
  enterprise: "Enterprise",
};

export const FEATURE_INFO: FeatureInfo[] = [
  {
    key: "full_findings",
    label: "All findings",
    description: "See every optimization opportunity from your cloud scan.",
    tier: "pro",
    tierLabel: TIER_LABELS.pro,
    icon: "magnifying-glass",
  },
  {
    key: "full_execution_plan",
    label: "Full execution plan",
    description: "Step-by-step plan with risk levels and savings estimates.",
    tier: "pro",
    tierLabel: TIER_LABELS.pro,
    icon: "list-checks",
  },
  {
    key: "terraform_export",
    label: "Terraform & CLI export",
    description: "Export as Terraform, CLI commands, or JSON.",
    tier: "pro",
    tierLabel: TIER_LABELS.pro,
    icon: "code",
  },
  {
    key: "explain_engine",
    label: "Ask the agent why",
    description: "Understand the reasoning behind every recommendation.",
    tier: "pro",
    tierLabel: TIER_LABELS.pro,
    icon: "chat-bubble",
  },
  {
    key: "approval_center",
    label: "Approval center",
    description: "Review and approve each action before it runs.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "shield-check",
  },
  {
    key: "safe_apply",
    label: "Safe apply",
    description: "Agent applies changes with prechecks and rollback.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "rocket",
  },
  {
    key: "scheduled_runs",
    label: "Scheduled scans",
    description: "Automatic daily or weekly agent scans.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "clock",
  },
  {
    key: "rollback_logs",
    label: "Rollback & audit logs",
    description: "Full audit trail with automated rollback controls.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "arrow-uturn-left",
  },
  {
    key: "multi_cloud",
    label: "Multi-cloud",
    description: "Scan AWS, Azure, and GCP in one unified view.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "cloud",
  },
  {
    key: "diff_engine",
    label: "Scan comparison",
    description: "Compare scans to track changes over time.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "arrows-right-left",
  },
  {
    key: "autopilot_modes",
    label: "Autopilot modes",
    description: "Control agent autonomy per cloud account.",
    tier: "growth",
    tierLabel: TIER_LABELS.growth,
    icon: "cpu-chip",
  },
];

// ---------------------------------------------------------------------------
// What free users see — preview description for onboarding
// ---------------------------------------------------------------------------

export const FREE_PREVIEW_COPY = {
  headline: "Your cloud scan is complete",
  subheadline: "Here's a preview of what the agent found.",
  whatYouGet: [
    "Top 3 findings with savings estimates",
    "Total savings preview across your account",
    "Risk summary (low / medium / high / critical)",
    "One sample action from the execution plan",
  ],
  whatProUnlocks: [
    "All findings with full detail",
    "Complete execution plan",
    "Terraform & CLI exports",
    "Ask the agent 'why' about any recommendation",
  ],
  whatScaleUnlocks: [
    "Approval center for per-action review",
    "Safe apply with prechecks & rollback",
    "Scheduled daily/weekly scans",
    "Multi-cloud scanning",
    "Scan-over-scan comparison & drift detection",
    "Full audit trail",
  ],
  ctaLabel: "See plans & pricing",
  ctaUrl: "/pricing?ref=axiom-preview",
  transparency: "You'll always be able to run scans and see your top findings for free. Paid plans unlock the full agent experience.",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_FEATURES: AxiomFeature[] = [
  "full_findings",
  "full_execution_plan",
  "terraform_export",
  "approval_center",
  "scheduled_runs",
  "safe_apply",
  "rollback_logs",
  "multi_cloud",
  "explain_engine",
  "diff_engine",
  "autopilot_modes",
];

export function getLockedFeatures(entitlements: PlanEntitlements): FeatureInfo[] {
  return FEATURE_INFO.filter(
    (f) => !checkFeatureAccess(entitlements, f.key).allowed,
  );
}

export function getUnlockedFeatures(entitlements: PlanEntitlements): FeatureInfo[] {
  return FEATURE_INFO.filter(
    (f) => checkFeatureAccess(entitlements, f.key).allowed,
  );
}

export function getNextUpgradeTier(entitlements: PlanEntitlements): OperatorTier | null {
  const current = TIER_RANK[entitlements.operatorTier];
  const tiers: OperatorTier[] = ["free", "pro", "growth", "enterprise"];
  return current < 3 ? tiers[current + 1] : null;
}

export function buildUpgradeSummary(entitlements: PlanEntitlements): {
  currentTier: OperatorTier;
  currentTierLabel: string;
  nextTier: OperatorTier | null;
  nextTierLabel: string | null;
  lockedFeatureCount: number;
  lockedFeatures: FeatureInfo[];
  unlockedFeatures: FeatureInfo[];
} {
  const nextTier = getNextUpgradeTier(entitlements);
  return {
    currentTier: entitlements.operatorTier,
    currentTierLabel: TIER_LABELS[entitlements.operatorTier],
    nextTier,
    nextTierLabel: nextTier ? TIER_LABELS[nextTier] : null,
    lockedFeatureCount: getLockedFeatures(entitlements).length,
    lockedFeatures: getLockedFeatures(entitlements),
    unlockedFeatures: getUnlockedFeatures(entitlements),
  };
}
