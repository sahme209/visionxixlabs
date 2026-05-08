import { prisma } from "@/lib/db";
import type { ActionDisposition, AgentRecommendation } from "./types";
import type { OrgPreferences } from "./preferences";
import type { ExecutionPlanItem, RiskLevel } from "../executionPlan";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutopilotMode = "observe_only" | "recommend" | "assisted_apply" | "full_guarded";

export type AutopilotPolicy = {
  mode: AutopilotMode;
  canGeneratePlan: boolean;
  canCreateApprovalRequests: boolean;
  canAutoApply: boolean;
  autoApplyRiskCeiling: RiskLevel | null;
  requiresExplicitApproval: boolean;
};

export type AutopilotDecision = {
  allowed: boolean;
  disposition: ActionDisposition;
  reason: string;
  autoApplied: boolean;
};

// ---------------------------------------------------------------------------
// Policy resolution — what the mode permits at each stage
//
// SAFETY INVARIANT: autopilot can only TIGHTEN dispositions. It can never
// promote an action to auto_fix_candidate that wasn't already classified
// as safe by the base disposition + org preferences pipeline.
//
// HARD RULE: high-risk actions are ALWAYS approval_required or report_only,
// regardless of autopilot mode. No exception. No override.
// ---------------------------------------------------------------------------

const POLICIES: Record<AutopilotMode, AutopilotPolicy> = {
  observe_only: {
    mode: "observe_only",
    canGeneratePlan: false,
    canCreateApprovalRequests: false,
    canAutoApply: false,
    autoApplyRiskCeiling: null,
    requiresExplicitApproval: true,
  },
  recommend: {
    mode: "recommend",
    canGeneratePlan: true,
    canCreateApprovalRequests: true,
    canAutoApply: false,
    autoApplyRiskCeiling: null,
    requiresExplicitApproval: true,
  },
  assisted_apply: {
    mode: "assisted_apply",
    canGeneratePlan: true,
    canCreateApprovalRequests: true,
    canAutoApply: true,
    autoApplyRiskCeiling: "medium",
    requiresExplicitApproval: true,
  },
  full_guarded: {
    mode: "full_guarded",
    canGeneratePlan: true,
    canCreateApprovalRequests: true,
    canAutoApply: true,
    autoApplyRiskCeiling: "low",
    requiresExplicitApproval: false,
  },
};

export function resolvePolicy(mode: AutopilotMode): AutopilotPolicy {
  return POLICIES[mode];
}

// ---------------------------------------------------------------------------
// resolveDisposition — applies autopilot mode as the final gate
//
// Call chain: base classifier → org preferences → autopilot mode
// Each step can only tighten. This function is the last step.
// ---------------------------------------------------------------------------

export function resolveDisposition(
  baseDisposition: ActionDisposition,
  riskLevel: RiskLevel | null,
  mode: AutopilotMode,
  hasExplicitApproval: boolean,
): AutopilotDecision {
  const policy = POLICIES[mode];

  // Hard rule: high-risk is never auto-applied
  if (riskLevel === "high") {
    return {
      allowed: false,
      disposition: baseDisposition === "auto_fix_candidate" ? "approval_required" : baseDisposition,
      reason: "High-risk actions always require manual review, regardless of autopilot mode.",
      autoApplied: false,
    };
  }

  // Observe only: everything becomes report_only
  if (mode === "observe_only") {
    return {
      allowed: false,
      disposition: "report_only",
      reason: "Autopilot is in Observe Only mode. The agent scans and reports but takes no action.",
      autoApplied: false,
    };
  }

  // Recommend: plans are created but nothing is applied
  if (mode === "recommend") {
    const tightened = baseDisposition === "auto_fix_candidate" ? "approval_required" : baseDisposition;
    return {
      allowed: false,
      disposition: tightened,
      reason: "Autopilot is in Recommend mode. Review the plan and upgrade to Assisted Apply to enable execution.",
      autoApplied: false,
    };
  }

  // Assisted apply: can apply if explicitly approved AND risk ≤ medium
  if (mode === "assisted_apply") {
    if (baseDisposition === "report_only" || baseDisposition === "blocked") {
      return {
        allowed: false,
        disposition: baseDisposition,
        reason: "This action is classified as report-only and cannot be applied in any mode.",
        autoApplied: false,
      };
    }

    if (!hasExplicitApproval) {
      return {
        allowed: false,
        disposition: "approval_required",
        reason: "Assisted Apply mode requires explicit approval before applying changes.",
        autoApplied: false,
      };
    }

    const riskAllowed = riskLevel === "low" || riskLevel === "medium";
    if (!riskAllowed) {
      return {
        allowed: false,
        disposition: "approval_required",
        reason: "This action's risk level exceeds the Assisted Apply ceiling.",
        autoApplied: false,
      };
    }

    return {
      allowed: true,
      disposition: baseDisposition,
      reason: "Action approved and within Assisted Apply risk ceiling.",
      autoApplied: false,
    };
  }

  // Full guarded autopilot: auto-apply low-risk auto_fix_candidates only
  if (mode === "full_guarded") {
    if (baseDisposition === "report_only" || baseDisposition === "blocked") {
      return {
        allowed: false,
        disposition: baseDisposition,
        reason: "This action is classified as report-only and cannot be applied in any mode.",
        autoApplied: false,
      };
    }

    if (riskLevel === "low" && baseDisposition === "auto_fix_candidate") {
      return {
        allowed: true,
        disposition: "auto_fix_candidate",
        reason: "Low-risk safe fix auto-applied under Full Guarded Autopilot.",
        autoApplied: true,
      };
    }

    if (riskLevel === "medium") {
      return {
        allowed: hasExplicitApproval,
        disposition: hasExplicitApproval ? baseDisposition : "approval_required",
        reason: hasExplicitApproval
          ? "Medium-risk action approved under Full Guarded Autopilot."
          : "Medium-risk actions require approval even in Full Guarded Autopilot.",
        autoApplied: false,
      };
    }

    return {
      allowed: false,
      disposition: "approval_required",
      reason: "This action requires explicit approval under Full Guarded Autopilot.",
      autoApplied: false,
    };
  }

  return {
    allowed: false,
    disposition: "approval_required",
    reason: "Unknown autopilot mode.",
    autoApplied: false,
  };
}

// ---------------------------------------------------------------------------
// Batch resolver — filters a set of recommendations through autopilot policy
// ---------------------------------------------------------------------------

export function applyAutopilotToRecommendations(
  recommendations: AgentRecommendation[],
  mode: AutopilotMode,
): Array<AgentRecommendation & { autopilotDecision: AutopilotDecision }> {
  return recommendations.map((rec) => {
    const decision = resolveDisposition(
      rec.disposition,
      rec.riskLevel,
      mode,
      false,
    );

    return {
      ...rec,
      disposition: decision.disposition,
      dispositionReason: `${rec.dispositionReason} ${decision.reason}`,
      actionable: decision.allowed,
      autopilotDecision: decision,
    };
  });
}

// ---------------------------------------------------------------------------
// Mode change — update the account and log the change
// ---------------------------------------------------------------------------

export async function changeAutopilotMode(
  cloudAccountId: string,
  organizationId: string,
  userId: string,
  newMode: AutopilotMode,
): Promise<{ previousMode: AutopilotMode; newMode: AutopilotMode }> {
  const account = await prisma.cloudAccount.findUniqueOrThrow({
    where: { id: cloudAccountId },
  });

  const previousMode = account.autopilotMode as AutopilotMode;

  if (previousMode === newMode) {
    return { previousMode, newMode };
  }

  await prisma.$transaction([
    prisma.cloudAccount.update({
      where: { id: cloudAccountId },
      data: { autopilotMode: newMode as any },
    }),
    prisma.axiomAutopilotEvent.create({
      data: {
        cloudAccountId,
        organizationId,
        userId,
        eventType: "mode_change",
        previousMode: previousMode as any,
        newMode: newMode as any,
        reason: `Autopilot mode changed from ${MODE_COPY[previousMode].label} to ${MODE_COPY[newMode].label}.`,
      },
    }),
  ]);

  return { previousMode, newMode };
}

// ---------------------------------------------------------------------------
// Autopilot audit — log when the agent auto-applies or blocks an action
// ---------------------------------------------------------------------------

export async function logAutopilotAction(
  cloudAccountId: string,
  organizationId: string,
  userId: string,
  decision: AutopilotDecision,
  context: {
    runId: string;
    actionType: string;
    riskLevel: RiskLevel;
    resourceIds: string[];
  },
): Promise<void> {
  await prisma.axiomAutopilotEvent.create({
    data: {
      cloudAccountId,
      organizationId,
      userId,
      eventType: decision.autoApplied ? "auto_applied" : "auto_blocked",
      runId: context.runId,
      actionType: context.actionType as any,
      riskLevel: context.riskLevel as any,
      disposition: decision.disposition as any,
      resourceIds: context.resourceIds,
      reason: decision.reason,
    },
  });
}

// ---------------------------------------------------------------------------
// Load autopilot mode for a cloud account
// ---------------------------------------------------------------------------

export async function loadAutopilotMode(cloudAccountId: string): Promise<AutopilotMode> {
  const account = await prisma.cloudAccount.findUnique({
    where: { id: cloudAccountId },
    select: { autopilotMode: true },
  });

  return (account?.autopilotMode as AutopilotMode) ?? "observe_only";
}

// ---------------------------------------------------------------------------
// UX copy — user-facing descriptions for each mode
// ---------------------------------------------------------------------------

export type AutopilotModeCopy = {
  label: string;
  shortDescription: string;
  longDescription: string;
  badge: string;
  warning: string | null;
  capabilities: string[];
  restrictions: string[];
};

export const MODE_COPY: Record<AutopilotMode, AutopilotModeCopy> = {
  observe_only: {
    label: "Observe Only",
    shortDescription: "Scan and report. No changes made.",
    longDescription:
      "The agent scans your cloud infrastructure and reports findings, but takes no action. " +
      "No execution plans are generated and no changes are proposed. " +
      "This is the safest mode — ideal for initial evaluation or compliance-restricted environments.",
    badge: "Read-only",
    warning: null,
    capabilities: [
      "Automated cloud scanning",
      "Finding and risk detection",
      "Cost savings identification",
      "Scheduled scan reports",
    ],
    restrictions: [
      "No execution plans generated",
      "No Terraform or CLI export",
      "No actions applied",
      "No approval requests created",
    ],
  },

  recommend: {
    label: "Recommend",
    shortDescription: "Scan, analyze, and recommend. No changes applied.",
    longDescription:
      "The agent scans your infrastructure, generates findings, and creates prioritized action plans " +
      "with execution previews. You can review plans and export Terraform, but the agent will not " +
      "apply any changes. Upgrade to Assisted Apply when you're ready to act on recommendations.",
    badge: "Plan only",
    warning: null,
    capabilities: [
      "Everything in Observe Only",
      "Prioritized action plans",
      "Terraform and CLI export",
      "Risk-rated recommendations",
      "Approval request creation",
    ],
    restrictions: [
      "No changes applied to infrastructure",
      "Manual execution required",
    ],
  },

  assisted_apply: {
    label: "Assisted Apply",
    shortDescription: "Apply approved fixes. You approve each action first.",
    longDescription:
      "The agent generates plans and creates approval requests. After you explicitly approve " +
      "an action, the agent applies it — but only for low and medium-risk changes. " +
      "High-risk actions are always report-only, regardless of approval. " +
      "Every applied change is verified and logged with a rollback plan.",
    badge: "Approval required",
    warning: "The agent will apply changes you approve. Review each action carefully.",
    capabilities: [
      "Everything in Recommend",
      "Apply approved low-risk fixes",
      "Apply approved medium-risk fixes",
      "Automated verification after apply",
      "Rollback plans for every action",
    ],
    restrictions: [
      "Every action requires explicit approval",
      "High-risk actions are report-only",
      "No automatic changes without your sign-off",
    ],
  },

  full_guarded: {
    label: "Full Guarded Autopilot",
    shortDescription: "Auto-apply safe fixes. Approve the rest.",
    longDescription:
      "The agent automatically applies low-risk, reversible fixes that the base classifier " +
      "marks as safe (e.g., storage lifecycle policies). Medium-risk actions still require " +
      "your approval. High-risk actions are always report-only. " +
      "Every auto-applied action is logged, verified, and has a rollback plan on file. " +
      "This mode is designed for teams that want continuous optimization with guardrails.",
    badge: "Auto-apply (low risk)",
    warning:
      "The agent will automatically apply low-risk changes without asking. " +
      "All actions are logged and reversible. Disable at any time.",
    capabilities: [
      "Everything in Assisted Apply",
      "Auto-apply low-risk safe fixes",
      "Continuous optimization",
      "Full audit trail of every auto-action",
      "Instant rollback capability",
    ],
    restrictions: [
      "Only low-risk auto_fix_candidates are auto-applied",
      "Medium-risk actions require approval",
      "High-risk actions are always report-only",
      "Cannot override the base safety classifier",
    ],
  },
};

// ---------------------------------------------------------------------------
// Mode comparison — for the settings UI
// ---------------------------------------------------------------------------

export const MODE_ORDER: AutopilotMode[] = [
  "observe_only",
  "recommend",
  "assisted_apply",
  "full_guarded",
];

export function isEscalation(from: AutopilotMode, to: AutopilotMode): boolean {
  return MODE_ORDER.indexOf(to) > MODE_ORDER.indexOf(from);
}

export function getModeConfirmationCopy(from: AutopilotMode, to: AutopilotMode): string {
  if (to === from) return "";

  if (to === "full_guarded") {
    return (
      "You're enabling Full Guarded Autopilot. The agent will automatically apply low-risk, " +
      "reversible changes to this cloud account without asking for approval first. " +
      "All actions are logged and can be rolled back. Are you sure?"
    );
  }

  if (to === "assisted_apply") {
    return (
      "You're enabling Assisted Apply. After you approve an action, the agent will apply it " +
      "directly to your cloud infrastructure. Only low and medium-risk actions can be applied. " +
      "Are you sure?"
    );
  }

  if (to === "observe_only" && from !== "observe_only") {
    return (
      "Switching to Observe Only will stop the agent from creating plans or applying changes. " +
      "Existing scheduled scans will continue, but results will be report-only."
    );
  }

  return `Switch from ${MODE_COPY[from].label} to ${MODE_COPY[to].label}?`;
}
