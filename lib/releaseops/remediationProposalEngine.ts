/**
 * Phase 512 — Autonomous Remediation Proposals engine.
 *
 * Pure decision function. Given an incident + its triage + release
 * context, projects a ranked list of remediation actions on-call
 * could take. Each proposal carries prerequisites, expected impact,
 * rollback-if-fails plan, and a reversibility flag.
 *
 * Operator-in-the-loop: the engine NEVER executes — it only proposes.
 */

export const REMEDIATION_ENGINE_VERSION = "remediation-v1.0.0";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const REMEDIATION_KINDS = [
  "rollback_release",
  "disable_feature_flag",
  "increase_replicas",
  "restart_service",
  "redirect_traffic",
  "throttle_requests",
  "escalate_to_vendor",
  "no_action_recommended",
] as const;
export type RemediationKind = (typeof REMEDIATION_KINDS)[number];

export const REMEDIATION_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type RemediationSeverity = (typeof REMEDIATION_SEVERITIES)[number];

/* ──────────────────────────────────────────────────────────────────
   Inputs.
   ────────────────────────────────────────────────────────────── */

export interface RemediationInputs {
  triage: {
    priority: "P0" | "P1" | "P2" | "P3";
    suggestedOwnerTeam: string;
    recommendedRunbook: string | null;
    autoEscalate: boolean;
  };
  incident: {
    id: string;
    title: string;
    summary: string | null;
    severity: string;
    reportedAtIso: string;
  };
  release: {
    id: string;
    status: string;
    releaseTag: string | null;
    /** Tag of the previous successfully-deployed release for rollback. */
    previousSuccessfulTag: string | null;
    /** Minutes since deploy (rollback safer when recent). */
    minutesSinceDeploy: number;
    isProduction: boolean;
  };
  /** Optional list of feature flags shipped with this release. */
  releaseFeatureFlags: string[];
  /** Capacity signal — true if observed load suggests saturation. */
  isCapacitySaturated: boolean;
  /** True if title/summary suggests upstream third-party fault. */
  thirdPartyDependencyHint: boolean;
  /** True if observed error rate is high enough to consider traffic shedding. */
  highErrorRate: boolean;
  /** Known runbook keys that the platform has runbook artifacts for. */
  availableRunbookKeys: string[];
  now: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface RemediationProposal {
  kind: RemediationKind;
  title: string;
  description: string;
  confidence: number;
  severity: RemediationSeverity;
  prerequisites: string[];
  expectedImpact: string;
  rollbackPlan: string;
  estimatedMinutes: number;
  reversible: boolean;
  rationale: string;
}

export interface RemediationOutput {
  engineVersion: string;
  generatedAtIso: string;
  proposals: RemediationProposal[];
  /** Highest-confidence non-no-action proposal, or null when only no-action fired. */
  primary: RemediationProposal | null;
}

/* ──────────────────────────────────────────────────────────────────
   Pure engine.
   ────────────────────────────────────────────────────────────── */

const SEVERITY_RANK: Record<RemediationSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function generateRemediationProposals(input: RemediationInputs): RemediationOutput {
  const proposals: RemediationProposal[] = [];
  const tier = input.triage.priority;
  const isUrgent = tier === "P0" || tier === "P1";

  // ── Rollback ────────────────────────────────────────────────────
  if (
    isUrgent &&
    input.release.previousSuccessfulTag &&
    input.release.minutesSinceDeploy <= 240 // within last 4 hours
  ) {
    const confidence = computeRollbackConfidence(input);
    proposals.push({
      kind: "rollback_release",
      title: `Rollback to ${input.release.previousSuccessfulTag}`,
      description: `Revert the active release from ${input.release.releaseTag ?? "(current)"} to ${input.release.previousSuccessfulTag}, which was the last known-good deploy.`,
      confidence,
      severity: tier === "P0" ? "critical" : "high",
      prerequisites: [
        "Confirm the previous release's evidence pack is signed.",
        "Verify the rollback runbook has been rehearsed at least once.",
        "Notify the on-call channel before initiating.",
      ],
      expectedImpact: "Brief unavailability during the cutover (typically 30-90 seconds). All write traffic should drain before flip.",
      rollbackPlan: `If rollback worsens state, re-deploy ${input.release.releaseTag ?? "the current tag"} via the standard pipeline. Capture both deployments in the audit trail.`,
      estimatedMinutes: input.release.minutesSinceDeploy < 60 ? 10 : 20,
      reversible: true,
      rationale: `Recent deploy (${input.release.minutesSinceDeploy}min ago) with a clean previous tag and a ${tier} triage — rollback is the highest-leverage move.`,
    });
  }

  // ── Disable feature flag ─────────────────────────────────────────
  if (isUrgent && input.releaseFeatureFlags.length > 0) {
    const flag = input.releaseFeatureFlags[0]; // pick the first; future ranking can re-order
    const confidence = 75 + Math.min(15, input.releaseFeatureFlags.length * 3);
    proposals.push({
      kind: "disable_feature_flag",
      title: `Disable feature flag "${flag}"`,
      description: `Toggle off the ${flag} feature flag introduced in this release. If the regression is gated by this flag, traffic returns to the prior code path instantly.`,
      confidence,
      severity: "high",
      prerequisites: [
        `Confirm the ${flag} flag is actually live (not just defined).`,
        "Identify which user cohorts are currently in the gated path.",
        "Have a rollback path for the flag config change ready.",
      ],
      expectedImpact: "Instant cutover — no deploy required. Affected users return to the prior code path. No data migration concerns.",
      rollbackPlan: `If disabling the flag does not resolve the incident, re-enable and proceed to rollback_release as the next step. If it does resolve, leave disabled until the gated code path is patched.`,
      estimatedMinutes: 5,
      reversible: true,
      rationale: `${input.releaseFeatureFlags.length} new feature flag(s) shipped with this release. Toggling is faster than rollback if the flag is the actual cause.`,
    });
  }

  // ── Increase replicas (capacity issue) ───────────────────────────
  if (input.isCapacitySaturated && isUrgent) {
    proposals.push({
      kind: "increase_replicas",
      title: "Scale up replicas",
      description: "Increase replica count for the affected service to absorb the current load while root-cause investigation continues.",
      confidence: 70,
      severity: tier === "P0" ? "high" : "medium",
      prerequisites: [
        "Verify HPA limits are not already at max.",
        "Confirm downstream services can handle increased request volume.",
        "Have a scale-down plan ready (don't leave at elevated capacity indefinitely).",
      ],
      expectedImpact: "Latency + error rate should drop within 2-5 minutes as new pods come online. Cost impact: roughly 2-4x while elevated.",
      rollbackPlan: "Scale back to baseline once root cause is identified and resolved.",
      estimatedMinutes: 5,
      reversible: true,
      rationale: "Capacity signal is saturated. Buying breathing room while diagnosis continues is cheaper than letting users fail.",
    });
  }

  // ── Restart service (when no other signal but mitigations needed) ─
  if (isUrgent && !input.isCapacitySaturated && !input.thirdPartyDependencyHint) {
    proposals.push({
      kind: "restart_service",
      title: "Restart affected service",
      description: "Rolling restart of pods/instances in the affected service. Last-resort mitigation for state corruption, memory leaks, or stuck connection pools.",
      confidence: 50,
      severity: "medium",
      prerequisites: [
        "Confirm restart will not cause data loss (in-flight writes drained).",
        "Verify graceful shutdown handlers are wired.",
        "Have observation in place to confirm symptoms clear post-restart.",
      ],
      expectedImpact: "Brief connection-reset spike during restart. If symptoms clear, root cause is likely state-related — file a follow-up to fix the underlying issue.",
      rollbackPlan: "No rollback needed — restart is idempotent. If symptoms persist after restart, escalate to rollback_release.",
      estimatedMinutes: 8,
      reversible: true,
      rationale: "No clearer signal pointing to capacity or upstream. Restart is a low-cost mitigation that catches state-related faults.",
    });
  }

  // ── Throttle requests (high error rate without capacity exhaustion) ─
  if (input.highErrorRate && !input.isCapacitySaturated && isUrgent) {
    proposals.push({
      kind: "throttle_requests",
      title: "Throttle inbound requests",
      description: "Apply rate limiting at the edge to shed load until the underlying issue is resolved.",
      confidence: 60,
      severity: "high",
      prerequisites: [
        "Identify which client(s) are generating the highest volume.",
        "Coordinate with affected client teams if they're internal.",
        "Set throttle limit slightly above baseline traffic to avoid full denial.",
      ],
      expectedImpact: "Error rate drops as failing requests are deflected. Some users see 429 responses. Recoverable from the client side.",
      rollbackPlan: "Remove throttle once the root cause is fixed. Throttle config is fully reversible.",
      estimatedMinutes: 5,
      reversible: true,
      rationale: "High error rate without capacity exhaustion suggests a downstream failure cascading upward. Throttling protects the service from the cascade.",
    });
  }

  // ── Escalate to vendor ──────────────────────────────────────────
  if (input.thirdPartyDependencyHint) {
    proposals.push({
      kind: "escalate_to_vendor",
      title: "Escalate to upstream vendor",
      description: "Open a P0/P1 ticket with the third-party dependency provider. Provide the platform's incident summary and timestamps.",
      confidence: 65,
      severity: tier === "P0" ? "high" : "medium",
      prerequisites: [
        "Identify the specific third-party service (e.g. Stripe, AWS RDS, vendor API).",
        "Locate the vendor escalation channel + SLA terms.",
        "Have your incident reference ID ready.",
      ],
      expectedImpact: "No immediate user-facing change. The vendor's response time depends on SLA — escalating early shortens the total recovery window.",
      rollbackPlan: "No rollback needed — escalation is an information action, not a state change.",
      estimatedMinutes: 10,
      reversible: true,
      rationale: "Incident hints at upstream dependency fault. Vendor escalation is critical-path even if internal mitigations also help.",
    });
  }

  // ── Redirect traffic (DR / failover for very urgent prod cases) ──
  if (tier === "P0" && input.release.isProduction && (input.thirdPartyDependencyHint || input.isCapacitySaturated)) {
    proposals.push({
      kind: "redirect_traffic",
      title: "Redirect traffic to secondary region/cluster",
      description: "Shift production traffic away from the impacted region to a known-healthy secondary. Use only if the primary issue is regional/cluster-scoped.",
      confidence: 55,
      severity: "critical",
      prerequisites: [
        "Confirm the secondary region/cluster has current state replication.",
        "Verify DNS TTLs / load balancer config support fast cutover.",
        "Have a cutback plan rehearsed — DR redirects must not become accidentally permanent.",
      ],
      expectedImpact: "Users in the affected region experience a brief reconnection. Application state continuity depends on replication lag.",
      rollbackPlan: "Cut traffic back to primary once the primary is healthy. Monitor for replication catch-up before the cutback.",
      estimatedMinutes: 15,
      reversible: true,
      rationale: "P0 + prod + scoped fault pattern. Traffic shift is the highest-impact escape hatch — but only if the failure mode is regional/cluster-scoped.",
    });
  }

  // ── No action recommended (engine couldn't justify a mitigation) ─
  if (proposals.length === 0) {
    proposals.push({
      kind: "no_action_recommended",
      title: "No automated remediation recommended",
      description: "The engine couldn't justify a high-confidence remediation. Continue manual diagnosis; revisit once you have a clearer signal.",
      confidence: 80,
      severity: "low",
      prerequisites: [],
      expectedImpact: "None. This is an informational signal.",
      rollbackPlan: "N/A.",
      estimatedMinutes: 0,
      reversible: true,
      rationale: tier === "P2" || tier === "P3"
        ? "Triage priority is low. Acting prematurely risks introducing more variance than the underlying issue."
        : "No prior release to roll back to, no feature flags, no capacity or vendor signal. Manual diagnosis is the cleanest path.",
    });
  }

  // Rank: severity desc, then confidence desc.
  proposals.sort((a, b) => (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b.confidence - a.confidence));

  const primary = proposals.find((p) => p.kind !== "no_action_recommended") ?? null;

  return {
    engineVersion: REMEDIATION_ENGINE_VERSION,
    generatedAtIso: input.now.toISOString(),
    proposals,
    primary,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Internal helpers.
   ────────────────────────────────────────────────────────────── */

function computeRollbackConfidence(input: RemediationInputs): number {
  let confidence = 70;
  // Very recent deploy → more confident rollback solves it.
  if (input.release.minutesSinceDeploy <= 30) confidence += 15;
  else if (input.release.minutesSinceDeploy <= 120) confidence += 8;
  // Has runbook → more confident operator can execute correctly.
  if (input.availableRunbookKeys.includes("rollback_drill")) confidence += 5;
  // P0 raises confidence (less time to be wrong).
  if (input.triage.priority === "P0") confidence += 5;
  return Math.min(95, confidence);
}
