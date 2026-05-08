import type { ActionType, RiskLevel } from "./executionPlan";
import type { CloudProvider } from "./cloudSnapshot";

// ---------------------------------------------------------------------------
// UX copy for the Apply Flow — safety-focused, provider-aware
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Apply confirmation modal
// ---------------------------------------------------------------------------

export type ConfirmationCopy = {
  title: string;
  subtitle: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  footnote: string;
};

export function getConfirmationCopy(
  actionCount: number,
  provider: CloudProvider,
  hasDowntime: boolean,
): ConfirmationCopy {
  return {
    title: `Apply ${actionCount} ${actionCount === 1 ? "change" : "changes"}`,
    subtitle: `These changes will be applied to your ${PROVIDER_LABEL[provider]} account.`,
    body: hasDowntime
      ? "Some actions require a brief instance restart. Each resource will be stopped, modified, and restarted individually. No data will be lost."
      : "These changes are non-disruptive. Your services will continue running normally.",
    confirmLabel: actionCount === 1 ? "Apply change" : `Apply ${actionCount} changes`,
    cancelLabel: "Cancel",
    footnote: "Every action is logged and reversible. You can review the full audit trail after applying.",
  };
}

// ---------------------------------------------------------------------------
// Risk-level messaging
// ---------------------------------------------------------------------------

export type RiskCopy = {
  badge: string;
  headline: string;
  explanation: string;
  actionGuidance: string;
};

export function getRiskCopy(risk: RiskLevel, actionType: ActionType, provider: CloudProvider): RiskCopy {
  switch (risk) {
    case "low":
      return getLowRiskCopy(actionType, provider);
    case "medium":
      return getMediumRiskCopy(actionType, provider);
    case "high":
      return getHighRiskCopy(actionType, provider);
  }
}

function getLowRiskCopy(actionType: ActionType, provider: CloudProvider): RiskCopy {
  const base: RiskCopy = {
    badge: "Low risk",
    headline: "Safe to apply",
    explanation: "",
    actionGuidance: "This change can be applied during normal operations.",
  };

  switch (actionType) {
    case "apply_storage_policy":
      base.explanation = "Lifecycle policies are applied asynchronously. Your data stays in place — objects transition to lower-cost tiers over time based on access patterns.";
      break;
    case "resize_compute":
      base.explanation = `Based on ${METRICS_SOURCE[provider]} data, this instance is consistently underutilized. Downsizing will reduce cost without affecting workload performance.`;
      base.actionGuidance = `Requires a brief restart (~${provider === "azure" ? "5–10" : "2–5"} minutes). The instance will be stopped, resized, and restarted.`;
      break;
    default:
      base.explanation = "This action has been validated against your current infrastructure state.";
  }

  return base;
}

function getMediumRiskCopy(actionType: ActionType, provider: CloudProvider): RiskCopy {
  const base: RiskCopy = {
    badge: "Review recommended",
    headline: "Confirm before applying",
    explanation: "",
    actionGuidance: "We recommend applying this during a maintenance window.",
  };

  switch (actionType) {
    case "resize_compute":
      base.explanation = "Usage data suggests this instance can be downsized, but the monitoring window is shorter than 7 days. There's a small chance the workload occasionally needs more capacity.";
      base.actionGuidance = `This will stop and restart the instance (~${provider === "azure" ? "5–10" : "2–5"} min downtime). If performance issues occur after resizing, you can resize back to the original type using the same process.`;
      break;
    case "apply_storage_policy":
      base.explanation = "This will apply tiering rules to multiple storage resources. Objects that haven't been accessed recently will gradually move to lower-cost tiers.";
      base.actionGuidance = "Review access patterns first. Frequently accessed data should remain in the standard tier. Already-transitioned objects incur retrieval fees if accessed.";
      break;
    default:
      base.explanation = "This action involves changes that should be reviewed before applying.";
  }

  return base;
}

function getHighRiskCopy(actionType: ActionType, provider: CloudProvider): RiskCopy {
  const base: RiskCopy = {
    badge: "Manual review required",
    headline: "Cannot be auto-applied",
    explanation: "",
    actionGuidance: "",
  };

  switch (actionType) {
    case "resize_compute":
      base.explanation = "There isn't enough usage data to confidently recommend this change. The instance may need its current capacity.";
      base.actionGuidance = "Collect at least 7 days of CPU and memory metrics before resizing. You can apply this manually after reviewing the data.";
      break;
    case "decommission_compute":
      base.explanation = "Deleting instances is permanent. Even with snapshots, restoration requires manual steps and the instance will have a new network identity.";
      base.actionGuidance = "Export the Terraform or CLI script and run it manually after verifying no services depend on these instances. Always snapshot first.";
      break;
    case "purchase_commitment":
      base.explanation = "Commitment purchases are a 1-year financial obligation that cannot be cancelled. This is a billing decision, not an infrastructure change.";
      base.actionGuidance = `Review the recommendation, then purchase directly in the ${PROVIDER_LABEL[provider]} console. Verify at least 3 months of stable workload history first.`;
      break;
    default:
      base.explanation = "This action requires manual review and cannot be automatically applied.";
      base.actionGuidance = "Download the execution plan and apply it manually after thorough review.";
  }

  return base;
}

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

export type StatusCopy = {
  title: string;
  message: string;
  detail: string | null;
  action: string | null;
};

// ---- Success ----

export function getSuccessCopy(
  actionCount: number,
  monthlySavings: number,
): StatusCopy {
  return {
    title: actionCount === 1
      ? "Change applied successfully"
      : `${actionCount} changes applied successfully`,
    message: `Estimated savings: $${monthlySavings.toLocaleString()}/mo. All changes have been verified and logged.`,
    detail: "You can review the full details in your audit log. If anything looks unexpected, rollback instructions are available for each action.",
    action: "View audit log",
  };
}

// ---- Failure ----

export function getFailureCopy(
  failedAction: ActionType,
  errorMessage: string,
  provider: CloudProvider,
): StatusCopy {
  return {
    title: "Change could not be applied",
    message: `The ${ACTION_LABEL[failedAction]} action was not completed. Your infrastructure was not modified.`,
    detail: `Error: ${errorMessage}. Check your ${PROVIDER_LABEL[provider]} credentials and permissions, then try again. If the issue persists, use the exported CLI script to apply manually.`,
    action: "View details",
  };
}

export function getPartialFailureCopy(
  applied: number,
  failed: number,
): StatusCopy {
  return {
    title: `${applied} applied, ${failed} failed`,
    message: `${applied} ${applied === 1 ? "change was" : "changes were"} applied successfully. ${failed} ${failed === 1 ? "action" : "actions"} could not be completed and ${failed === 1 ? "was" : "were"} skipped.`,
    detail: "Successfully applied changes are already active. Failed actions were not applied — your infrastructure is unchanged for those resources. Review the details below.",
    action: "Review results",
  };
}

// ---- Precheck failure ----

export function getPrecheckFailureCopy(
  blockers: string[],
): StatusCopy {
  return {
    title: "Precheck did not pass",
    message: "We found an issue that needs to be resolved before this change can be applied safely.",
    detail: blockers.length === 1
      ? blockers[0]
      : `Issues found:\n${blockers.map((b, i) => `${i + 1}. ${b}`).join("\n")}`,
    action: "Review issues",
  };
}

// ---------------------------------------------------------------------------
// Rollback available
// ---------------------------------------------------------------------------

export type RollbackCopy = {
  title: string;
  message: string;
  automated: string;
  manual: string;
  footnote: string;
};

export function getRollbackCopy(
  actionType: ActionType,
  automated: boolean,
  estimatedMinutes: number,
): RollbackCopy {
  const base: RollbackCopy = {
    title: "Rollback available",
    message: "",
    automated: "",
    manual: "",
    footnote: "Rollback instructions are saved with the audit log and can be accessed at any time.",
  };

  switch (actionType) {
    case "resize_compute":
      base.message = "This instance can be resized back to its original type using the same stop/modify/start process.";
      base.automated = `Estimated time: ~${estimatedMinutes} minutes. The instance will experience the same brief restart as the original resize.`;
      base.manual = "You can also resize manually in the cloud console. The original instance type is recorded in the audit log.";
      break;
    case "apply_storage_policy":
      base.message = "The lifecycle policy can be removed to stop future transitions. Objects already moved to a colder tier will remain there.";
      base.automated = "Removing the policy takes effect immediately. No data is moved or deleted.";
      base.manual = "To fully revert, you would need to manually change the storage class of already-transitioned objects. This incurs retrieval and transfer costs.";
      break;
    case "purchase_commitment":
      base.title = "No rollback available";
      base.message = "Commitment purchases cannot be cancelled or refunded. The commitment will expire at the end of the purchased term.";
      base.automated = "Disable auto-renewal to prevent the commitment from extending.";
      base.manual = "Contact your cloud provider's support team to discuss exchange options, if available.";
      break;
    case "decommission_compute":
      base.title = "Rollback from snapshot";
      base.message = "The instance can be restored from the pre-deletion snapshot. The restored instance will have a new ID and IP address.";
      base.automated = "";
      base.manual = "Restoration requires creating a new disk from the snapshot, launching a new instance, and reassigning network configuration. See the rollback script in the audit log.";
      break;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Audit log confirmation
// ---------------------------------------------------------------------------

export type AuditCopy = {
  title: string;
  message: string;
  fields: string[];
};

export function getAuditCopy(): AuditCopy {
  return {
    title: "Audit log created",
    message: "A complete record of this action has been saved, including the original state, what was changed, and how to reverse it.",
    fields: [
      "Action type and target resources",
      "Before and after infrastructure state",
      "Timestamp and user who applied",
      "Rollback instructions",
      "Precheck and verification results",
    ],
  };
}

// ---------------------------------------------------------------------------
// Inline helper labels
// ---------------------------------------------------------------------------

const PROVIDER_LABEL: Record<CloudProvider, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "Google Cloud",
};

const ACTION_LABEL: Record<ActionType, string> = {
  resize_compute: "compute resize",
  apply_storage_policy: "storage tiering",
  purchase_commitment: "commitment purchase",
  decommission_compute: "instance decommission",
  restrict_public_access: "public access restriction",
  enable_backup: "backup enablement",
};

const METRICS_SOURCE: Record<CloudProvider, string> = {
  aws: "CloudWatch",
  azure: "Azure Monitor",
  gcp: "Cloud Monitoring",
};
