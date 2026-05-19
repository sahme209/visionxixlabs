/**
 * Autonomous remediation runbook generator.
 *
 * Given the live CloudTrail event tail, produces typed
 * `RemediationRunbook` proposals: one per "interesting" event
 * (high/critical severity from the CloudTrail classifier). Each
 * runbook has:
 *
 *   • rootCauseHypothesis   — a plain-English guess at why the event
 *                             happened (who acted + what + when).
 *   • reversal              — the action that would revert the change
 *                             (e.g. "Re-enable Public Access Block on
 *                             bucket X"). Approval-required.
 *   • hardening             — a forward-looking action that reduces
 *                             the likelihood of recurrence (e.g.
 *                             "Add SCP denying s3:PutBucketAcl").
 *                             Approval-required.
 *   • confidence            — 0..1 heuristic; high when the event +
 *                             entity match a known recipe; low when
 *                             we're inferring.
 *
 * Hard rules:
 *   - Pure planning. **Never executes** anything. Every action is a
 *     proposal that lands in the Approval Packets queue.
 *   - Read-only inputs (CloudTrail extraction).
 *   - Safe-by-default: when we don't recognize an event, we emit a
 *     "needs human triage" runbook with no auto-revertible action.
 */

import "server-only";

import { extractCloudTrailEvents, type CloudTrailEventSummary, type CloudTrailExtraction } from "@/lib/cloud/aws/awsCloudTrailExtractor";

export type RunbookSeverity = "critical" | "high" | "medium" | "low" | "info";
export type RunbookActionRisk = "safe_revert" | "policy_change" | "needs_human_triage";

export interface RunbookAction {
  /** Short imperative label (e.g. "Re-enable S3 Public Access Block"). */
  label: string;
  /** What the action does in plain English. */
  description: string;
  /** Risk class — drives the approval gate. */
  risk: RunbookActionRisk;
  /** Suggested API surface (e.g. "s3:PutPublicAccessBlock"). */
  suggestedApi?: string;
  /** Operator-actionable href (always a read-only review page, never a mutate). */
  reviewHref: string;
}

export interface RemediationRunbook {
  id: string;
  generatedAt: string;
  sourceEventId: string;
  eventName: string;
  eventTime?: string;
  severity: RunbookSeverity;
  rootCauseHypothesis: string;
  affectedResource: string;
  /** The revert action (returns state to "before"). */
  reversal: RunbookAction;
  /** The harden action (reduces recurrence likelihood). */
  hardening: RunbookAction;
  /** 0..1 — high when matched to a recipe, low when generic. */
  confidence: number;
  /** Evidence refs the operator can verify. */
  evidenceRefs: string[];
}

export interface RemediationRunbookReport {
  generatedAt: string;
  lookbackMinutes: number;
  totalEventsInspected: number;
  totalRunbooks: number;
  highOrCriticalCount: number;
  runbooks: RemediationRunbook[];
  durationMs: number;
  limitations: string[];
}

export async function generateRemediationRunbooks(opts?: { lookbackMinutes?: number }): Promise<RemediationRunbookReport> {
  const start = Date.now();
  const trail: CloudTrailExtraction = await extractCloudTrailEvents({ lookbackMinutes: opts?.lookbackMinutes });
  const runbooks: RemediationRunbook[] = [];

  for (const e of trail.events) {
    if (e.severity === "info" || e.severity === "low") continue;
    runbooks.push(buildRunbook(e));
  }

  // Sort by severity, then by event time (newest first).
  runbooks.sort((a, b) => {
    const dx = severityRank(b.severity) - severityRank(a.severity);
    if (dx !== 0) return dx;
    return (b.eventTime ?? "").localeCompare(a.eventTime ?? "");
  });

  return {
    generatedAt: new Date().toISOString(),
    lookbackMinutes: trail.lookbackMinutes,
    totalEventsInspected: trail.total,
    totalRunbooks: runbooks.length,
    highOrCriticalCount: runbooks.filter((r) => r.severity === "high" || r.severity === "critical").length,
    runbooks: runbooks.slice(0, 50),
    durationMs: Date.now() - start,
    limitations: trail.limitations,
  };
}

// ---------------------------------------------------------------------------
// Recipe table — per event name, declare the canonical revert + harden.
// ---------------------------------------------------------------------------

interface Recipe {
  reversal: Omit<RunbookAction, "reviewHref">;
  hardening: Omit<RunbookAction, "reviewHref">;
  confidence: number;
}

const RECIPES: Record<string, Recipe> = {
  DeleteBucket: {
    reversal: {
      label: "Restore bucket from backup",
      description: "Open AWS Backup vault for the affected bucket and initiate restore. Cannot un-delete in place — restore creates a new bucket from the most recent recovery point.",
      risk: "needs_human_triage",
      suggestedApi: "backup:StartRestoreJob",
    },
    hardening: {
      label: "Enable S3 Object Lock + MFA Delete on critical buckets",
      description: "Add an SCP scope that requires `s3:DeleteBucket` to come from a role with MFA. Enable Object Lock in compliance mode on buckets holding regulated data.",
      risk: "policy_change",
      suggestedApi: "s3:PutObjectLockConfiguration",
    },
    confidence: 0.92,
  },
  PutBucketPublicAccessBlock: {
    reversal: {
      label: "Re-enable Public Access Block",
      description: "Re-apply the four PAB flags (BlockPublicAcls + IgnorePublicAcls + BlockPublicPolicy + RestrictPublicBuckets) to the affected bucket.",
      risk: "safe_revert",
      suggestedApi: "s3:PutPublicAccessBlock",
    },
    hardening: {
      label: "Account-level S3 Block Public Access",
      description: "Turn on Block Public Access at the account level so per-bucket changes can't re-expose data. Add an SCP denying `s3:PutPublicAccessBlock` when the request would weaken the posture.",
      risk: "policy_change",
      suggestedApi: "s3:PutAccountPublicAccessBlock",
    },
    confidence: 0.95,
  },
  DeleteTrail: {
    reversal: {
      label: "Recreate the deleted CloudTrail trail",
      description: "Recreate the trail with the same name, S3 destination, and KMS key. Apply log file validation immediately.",
      risk: "needs_human_triage",
      suggestedApi: "cloudtrail:CreateTrail",
    },
    hardening: {
      label: "SCP denying cloudtrail:DeleteTrail + StopLogging",
      description: "Add an Organizations Service Control Policy that denies `cloudtrail:DeleteTrail` and `cloudtrail:StopLogging` to everyone except a break-glass role.",
      risk: "policy_change",
      suggestedApi: "organizations:AttachPolicy",
    },
    confidence: 0.95,
  },
  StopLogging: {
    reversal: {
      label: "Restart CloudTrail logging",
      description: "Call `cloudtrail:StartLogging` on the trail. Then audit the gap — every event between StopLogging and StartLogging is unrecoverable from CloudTrail itself; use VPC Flow Logs / WAF logs / app logs to fill the window.",
      risk: "safe_revert",
      suggestedApi: "cloudtrail:StartLogging",
    },
    hardening: {
      label: "Multi-region trail + S3 bucket lock on the log destination",
      description: "Convert single-region trails to multi-region. Add a bucket policy denying deletes on the CloudTrail log destination bucket.",
      risk: "policy_change",
      suggestedApi: "cloudtrail:UpdateTrail",
    },
    confidence: 0.94,
  },
  AuthorizeSecurityGroupIngress: {
    reversal: {
      label: "Revoke the new security-group ingress rule",
      description: "Call `ec2:RevokeSecurityGroupIngress` with the exact rule (cidr + port + protocol) the CloudTrail event captured.",
      risk: "safe_revert",
      suggestedApi: "ec2:RevokeSecurityGroupIngress",
    },
    hardening: {
      label: "SCP forbidding 0.0.0.0/0 on admin ports",
      description: "Add an SCP that denies `ec2:AuthorizeSecurityGroupIngress` when the cidr is `0.0.0.0/0` AND the port range covers 22 / 3389 / 3306 / 5432.",
      risk: "policy_change",
      suggestedApi: "organizations:AttachPolicy",
    },
    confidence: 0.9,
  },
  DisableKey: {
    reversal: {
      label: "Re-enable the KMS key",
      description: "Call `kms:EnableKey` on the affected KMS key. Audit any IAM principals that lost access while the key was disabled.",
      risk: "safe_revert",
      suggestedApi: "kms:EnableKey",
    },
    hardening: {
      label: "SCP denying kms:DisableKey + ScheduleKeyDeletion on prod keys",
      description: "Add an SCP scoped to keys tagged `Env=prod` that denies `kms:DisableKey` and `kms:ScheduleKeyDeletion` except from break-glass.",
      risk: "policy_change",
      suggestedApi: "organizations:AttachPolicy",
    },
    confidence: 0.92,
  },
  ScheduleKeyDeletion: {
    reversal: {
      label: "Cancel the scheduled KMS key deletion",
      description: "Call `kms:CancelKeyDeletion` immediately. The deletion window is 7-30 days; cancelling before then preserves the key material.",
      risk: "safe_revert",
      suggestedApi: "kms:CancelKeyDeletion",
    },
    hardening: {
      label: "Tag prod KMS keys with deletion-protection SCP",
      description: "Tag all prod KMS keys with `Env=prod`. Add an SCP that denies `kms:ScheduleKeyDeletion` against any key with that tag.",
      risk: "policy_change",
      suggestedApi: "organizations:AttachPolicy",
    },
    confidence: 0.9,
  },
  TerminateInstances: {
    reversal: {
      label: "Restore from AMI snapshot",
      description: "Cannot un-terminate. Restore by launching a new EC2 instance from the most recent AMI / EBS snapshot. Re-attach Elastic IPs / Route 53 records.",
      risk: "needs_human_triage",
      suggestedApi: "ec2:RunInstances",
    },
    hardening: {
      label: "Enable termination protection on stateful instances",
      description: "For every EC2 instance with an EBS volume tagged `Persistent=true`, set `DisableApiTermination=true`. Add an SCP denying `ec2:ModifyInstanceAttribute` of that field.",
      risk: "policy_change",
      suggestedApi: "ec2:ModifyInstanceAttribute",
    },
    confidence: 0.85,
  },
  CreateAccessKey: {
    reversal: {
      label: "Deactivate the new IAM access key",
      description: "Call `iam:UpdateAccessKey` with `Status=Inactive` on the key id just created. Audit any usage of the key between creation and deactivation.",
      risk: "safe_revert",
      suggestedApi: "iam:UpdateAccessKey",
    },
    hardening: {
      label: "Replace IAM users with SSO + short-lived role sessions",
      description: "Migrate the affected user to AWS IAM Identity Center (SSO). Add an SCP denying `iam:CreateAccessKey` for every user except break-glass.",
      risk: "policy_change",
      suggestedApi: "organizations:AttachPolicy",
    },
    confidence: 0.93,
  },
  AttachUserPolicy: {
    reversal: {
      label: "Detach the just-attached policy",
      description: "Call `iam:DetachUserPolicy` with the exact policy ARN the CloudTrail event captured.",
      risk: "safe_revert",
      suggestedApi: "iam:DetachUserPolicy",
    },
    hardening: {
      label: "Permission boundary on every IAM user",
      description: "Apply a permission boundary policy to every IAM user that caps the effective permissions regardless of attached policies. Add an SCP denying `iam:DeleteUserPermissionsBoundary`.",
      risk: "policy_change",
      suggestedApi: "iam:PutUserPermissionsBoundary",
    },
    confidence: 0.9,
  },
};

function buildRunbook(e: CloudTrailEventSummary): RemediationRunbook {
  const recipe = RECIPES[e.eventName];
  const reviewHref = "/dashboard/approval-packets";
  const evidenceRefs = [`cloudtrail:event:${e.eventId}`];

  const rootCause = describeRootCause(e);
  const severity: RunbookSeverity = e.severity;

  if (recipe) {
    return {
      id: `runbook:${e.eventId}`,
      generatedAt: new Date().toISOString(),
      sourceEventId: e.eventId,
      eventName: e.eventName,
      eventTime: e.eventTime,
      severity,
      rootCauseHypothesis: rootCause,
      affectedResource: e.eventSource ?? "unknown",
      reversal: { ...recipe.reversal, reviewHref },
      hardening: { ...recipe.hardening, reviewHref },
      confidence: recipe.confidence,
      evidenceRefs,
    };
  }

  // Unknown event → human triage runbook.
  return {
    id: `runbook:${e.eventId}`,
    generatedAt: new Date().toISOString(),
    sourceEventId: e.eventId,
    eventName: e.eventName,
    eventTime: e.eventTime,
    severity,
    rootCauseHypothesis: rootCause,
    affectedResource: e.eventSource ?? "unknown",
    reversal: {
      label: "Needs human triage",
      description: `No canonical reversal recipe for ${e.eventName}. Open the CloudTrail event and decide whether a revert is appropriate.`,
      risk: "needs_human_triage",
      reviewHref,
    },
    hardening: {
      label: "Add a detection rule for this event name",
      description: `Tune CloudWatch / GuardDuty / SIEM to alert on ${e.eventName} so future occurrences surface earlier. Capture context (which role, when, from where) so the next runbook can be more specific.`,
      risk: "policy_change",
      reviewHref,
    },
    confidence: 0.35,
    evidenceRefs,
  };
}

function describeRootCause(e: CloudTrailEventSummary): string {
  const who = e.rootUser ? "the AWS account root user" : e.username ? `principal \`${e.username}\`` : "an unknown principal";
  const when = e.eventTime ? ` at ${e.eventTime}` : "";
  const where = e.region ? ` in region ${e.region}` : "";
  const outcome = e.outcome === "failure"
    ? ` — the API call failed${e.errorCode ? ` with ${e.errorCode}` : ""}`
    : e.outcome === "success" ? "" : " — outcome unknown";
  return `${who} invoked ${e.eventName} on ${e.eventSource ?? "an unknown service"}${where}${when}${outcome}.`;
}

function severityRank(s: RunbookSeverity): number {
  switch (s) {
    case "critical": return 4;
    case "high":     return 3;
    case "medium":   return 2;
    case "low":      return 1;
    case "info":     return 0;
  }
}
