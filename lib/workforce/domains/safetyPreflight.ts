/**
 * Safety triad pre-flight — Phase 613.
 *
 * Runs the operator's proposed action through all three safety
 * engineers (policy_gate → boundary_gate → approver) in one call
 * and returns a composed verdict. The action pipeline calls this
 * before any autonomous action lands so the safety triad becomes
 * a real gate instead of a manual paste tool.
 *
 * The three engineers each take slightly different input fields —
 * the pre-flight maps the single proposed-action payload into each
 * engineer's input shape so the operator only specifies the action
 * once.
 *
 * Composed verdict:
 *   · allow      — policy=pass, boundary∈{contained,limited},
 *                  approver=approve. Safe to proceed without further
 *                  human review.
 *   · review     — at least one engineer flagged caution but no
 *                  hard refusal. Surface the packet to the operator.
 *   · block      — policy=refuse, boundary∈{platform,catastrophic},
 *                  or approver=reject. Never auto-advance.
 *
 * Server-only.
 */

import "server-only";

import { runPolicyGateEngineer, persistPolicyClassification } from "@/lib/workforce/domains/policyGateEngineer";
import { runBoundaryGateEngineer, persistBoundaryClassification } from "@/lib/workforce/domains/boundaryGateEngineer";
import { runApproverEngineer, persistApprovalPacket } from "@/lib/workforce/domains/approverEngineer";

export type PreflightVerdict = "allow" | "review" | "block";

export interface SafetyPreflightInput {
  /** Stable identifier for this pre-flight, used as targetId for
   *  each engineer's persisted row. */
  preflightSlug: string;
  /** Human title surfaced on the packet. */
  title: string;
  /** Action prose the operator wants to run. */
  actionDescription: string;
  /** Current-state snapshot describing what the action will touch. */
  currentState: string;
  /** Risk context describing what could go wrong. */
  riskContext: string;
  /** Optional tenant charter. When empty, policy_gate is skipped
   *  and the composed verdict defaults to "review". */
  tenantCharter?: string;
}

export interface SafetyPreflightResult {
  verdict: PreflightVerdict;
  reasons: ReadonlyArray<string>;
  policyDecision: string | null;
  boundaryTier: string | null;
  approverDecision: string | null;
  errors: ReadonlyArray<string>;
  modelHints: { policy: string | null; boundary: string | null; approver: string | null };
}

export async function runSafetyPreflight(
  organizationId: string,
  input: SafetyPreflightInput,
): Promise<SafetyPreflightResult> {
  const reasons: string[] = [];
  const errors: string[] = [];

  // Run all three engineers in parallel — they're independent reads.
  // Each persists its own row keyed off the same preflightSlug so an
  // operator can trace which composed pre-flight produced which row.
  const [policy, boundary, approver] = await Promise.allSettled([
    input.tenantCharter && input.tenantCharter.trim().length > 0
      ? runPolicyGateEngineer(organizationId, {
          title: input.title,
          proposedAction: input.actionDescription,
          tenantCharter: input.tenantCharter,
        })
      : Promise.resolve(null),
    runBoundaryGateEngineer(organizationId, {
      title: input.title,
      actionDescription: input.actionDescription,
    }),
    runApproverEngineer(organizationId, {
      title: input.title,
      proposalDescription: input.actionDescription,
      riskContext: input.riskContext,
    }),
  ]);

  // Persist each (best-effort) so the packet is auditable. Override
  // the engineer-internal slug with the composed slug for trace.
  const policyValue = policy.status === "fulfilled" ? policy.value : null;
  const boundaryValue = boundary.status === "fulfilled" ? boundary.value : null;
  const approverValue = approver.status === "fulfilled" ? approver.value : null;

  if (policy.status === "rejected") errors.push(`policy: ${errToMsg(policy.reason)}`);
  if (boundary.status === "rejected") errors.push(`boundary: ${errToMsg(boundary.reason)}`);
  if (approver.status === "rejected") errors.push(`approver: ${errToMsg(approver.reason)}`);

  if (policyValue) {
    try {
      await persistPolicyClassification(organizationId, {
        ...policyValue,
        slug: `${input.preflightSlug}__policy`,
      });
    } catch (err) {
      errors.push(`policy_persist: ${errToMsg(err)}`);
    }
  }
  if (boundaryValue) {
    try {
      await persistBoundaryClassification(organizationId, {
        ...boundaryValue,
        slug: `${input.preflightSlug}__boundary`,
      });
    } catch (err) {
      errors.push(`boundary_persist: ${errToMsg(err)}`);
    }
  }
  if (approverValue) {
    try {
      await persistApprovalPacket(organizationId, {
        ...approverValue,
        slug: `${input.preflightSlug}__approver`,
      });
    } catch (err) {
      errors.push(`approver_persist: ${errToMsg(err)}`);
    }
  }

  // Compose the verdict.
  let verdict: PreflightVerdict = "review";

  // Hard blocks first.
  if (policyValue?.decision === "refuse") {
    verdict = "block";
    reasons.push("policy_gate refused: charter forbids the action");
  }
  if (boundaryValue?.tier === "platform" || boundaryValue?.tier === "catastrophic") {
    verdict = "block";
    reasons.push(`boundary_gate tier=${boundaryValue.tier} — blast radius exceeds autonomous-action ceiling`);
  }
  if (approverValue?.recommendedDecision === "reject") {
    verdict = "block";
    reasons.push("approver rejected: risk outweighs benefit");
  }

  if (verdict === "block") {
    return summarize(verdict, reasons, errors, policyValue, boundaryValue, approverValue);
  }

  // Allow path — all three green.
  if (
    (policyValue === null || policyValue.decision === "pass") &&
    (boundaryValue?.tier === "contained" || boundaryValue?.tier === "limited") &&
    approverValue?.recommendedDecision === "approve"
  ) {
    verdict = "allow";
    reasons.push("all three safety engineers cleared the action — safe to auto-advance");
    return summarize(verdict, reasons, errors, policyValue, boundaryValue, approverValue);
  }

  // Otherwise: review.
  if (policyValue?.decision === "needs_amendment") {
    reasons.push("policy_gate needs_amendment: charter must be amended before signing");
  }
  if (boundaryValue?.tier === "broad") {
    reasons.push("boundary_gate broad: blast crosses tenants — surface to operator");
  }
  if (approverValue?.recommendedDecision === "revise") {
    reasons.push("approver revise: scope or guardrails missing");
  }
  if (approverValue?.recommendedDecision === "escalate") {
    reasons.push("approver escalate: authority exceeds operator scope");
  }
  if (reasons.length === 0) {
    reasons.push("at least one safety engineer returned a non-canonical outcome — surfacing for operator review");
  }
  return summarize(verdict, reasons, errors, policyValue, boundaryValue, approverValue);
}

function summarize(
  verdict: PreflightVerdict,
  reasons: ReadonlyArray<string>,
  errors: ReadonlyArray<string>,
  policy: Awaited<ReturnType<typeof runPolicyGateEngineer>> | null,
  boundary: Awaited<ReturnType<typeof runBoundaryGateEngineer>> | null,
  approver: Awaited<ReturnType<typeof runApproverEngineer>> | null,
): SafetyPreflightResult {
  return {
    verdict,
    reasons,
    policyDecision: policy?.decision ?? null,
    boundaryTier: boundary?.tier ?? null,
    approverDecision: approver?.recommendedDecision ?? null,
    errors,
    modelHints: {
      policy: policy?.modelHint ?? null,
      boundary: boundary?.modelHint ?? null,
      approver: approver?.modelHint ?? null,
    },
  };
}

function errToMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
