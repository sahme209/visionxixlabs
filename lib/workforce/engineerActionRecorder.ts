/**
 * End-to-end recorder for an engineer action attempt.
 *
 * Orchestrates the full pipeline from "agent wants to do something"
 * to "we have a verdict + audit row + (maybe) approval":
 *
 *   1. Look up the canonical engineer in the registry.
 *   2. Look up the workspace's tightened rule + enabled flag.
 *   3. Call evaluateEngineerActionAttempt() to get a verdict.
 *   4. Append an AgentEngineerActionAttempt row.
 *   5. Emit a SecureAuditRecord row with the verdict + correlation id.
 *   6. Return the verdict so the caller decides whether to execute,
 *      stage an approval, or refuse.
 *
 * Approval-engine wiring lands in a follow-up — for now the recorder
 * stops at the verdict + audit, surfaces a hint that an approval
 * needs to be created, and stores a placeholder approvalRequestId.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import type { OrganizationId, UserId, CorrelationId } from "@/lib/domain/ids";
import {
  AGENT_WORKFORCE_REGISTRY,
  type ApprovalRule,
} from "./agentWorkforceRegistry";
import {
  evaluateEngineerActionAttempt,
  type ActionVerdict,
  type EngineerActionAttempt,
} from "./runtimeActionGate";
import { loadWorkspaceEngineerMap } from "./workspaceRegistrySync";

export interface RecorderInput extends EngineerActionAttempt {
  /** Existing correlation id if this attempt belongs to a larger workflow run. */
  correlationId?: string;
}

export interface RecorderOutput {
  verdict: ActionVerdict;
  attemptId: string;
  correlationId: string;
  /** Set when verdict.decision === "requires_approval" — the caller should create the approval. */
  approvalRequestNeeded: boolean;
}

const APPROVAL_RULES: ReadonlySet<ApprovalRule> = new Set([
  "no_approval_needed",
  "single_approver",
  "two_step_approval",
  "incident_commander_only",
  "blocked_always",
]);

function asApprovalRule(value: string | null | undefined): ApprovalRule | undefined {
  if (value && APPROVAL_RULES.has(value as ApprovalRule)) return value as ApprovalRule;
  return undefined;
}

export async function recordEngineerActionAttempt(input: RecorderInput): Promise<RecorderOutput> {
  const correlationId = (input.correlationId ?? `eng_${Date.now().toString(36)}`) as CorrelationId;

  // Canonical lookup
  const engineer = AGENT_WORKFORCE_REGISTRY.find((e) => e.id === input.engineerId);

  // Workspace-tightened rule + enabled flag
  let workspaceOverride: ApprovalRule | undefined;
  let workspaceEnabled: boolean | undefined;
  let recordRowId: string | undefined;
  try {
    const map = await loadWorkspaceEngineerMap(input.workspaceId);
    const row = map.get(input.engineerId);
    if (row) {
      recordRowId = row.id;
      workspaceOverride = asApprovalRule(row.currentApprovalRule);
      workspaceEnabled = row.isEnabled;
    }
  } catch {
    // Sync hasn't run yet — fall through with no override/enabled flag.
  }

  // Pure gate decision
  const verdict = evaluateEngineerActionAttempt(input, {
    engineer,
    workspaceOverride,
    workspaceEnabled,
  });

  // Append the attempt row (best-effort — never fails the caller).
  let attemptId = `attempt_${Date.now().toString(36)}`;
  if (recordRowId) {
    try {
      const created = await prisma.agentEngineerActionAttempt.create({
        data: {
          organizationId: input.workspaceId,
          recordId: recordRowId,
          engineerId: input.engineerId,
          action: input.action,
          riskLevel: input.riskLevel,
          isReadOnly: input.isReadOnly,
          module: input.module,
          connector: input.connector,
          runtimeDecision: verdict.decision,
          effectiveRule: verdict.effectiveRule,
          policySource: verdict.policySource,
          requiredApprovers: verdict.requiredApprovers,
          requestedBy: input.requestedBy,
          correlationId,
          reason: verdict.reason,
          metadata: (input.metadata ?? null) as never,
        },
        select: { id: true },
      });
      attemptId = created.id;
    } catch {
      // Persistence failure must not break enforcement. Verdict already
      // computed; audit row will still attempt to write below.
    }
  }

  // Emit audit row.
  try {
    await recordAudit({
      organizationId: idFactory.organization(input.workspaceId) as OrganizationId,
      actorUserId: idFactory.user(input.requestedBy) as UserId,
      actorKind: "system",
      action: verdict.auditTopic, // typed AuditAction since Phase 362.
      outcome: verdict.decision === "blocked" ? "blocked" : verdict.decision === "allowed" ? "success" : "success",
      entityRef: `engineer:${input.engineerId}`,
      correlationId,
      source: "live",
      detail: {
        engineerId: input.engineerId,
        action: input.action,
        riskLevel: input.riskLevel,
        runtimeDecision: verdict.decision,
        effectiveRule: verdict.effectiveRule,
        policySource: verdict.policySource,
        ...(input.module ? { module: input.module } : {}),
        ...(input.connector ? { connector: input.connector } : {}),
      },
    });
  } catch {
    // Best-effort — the verdict already enforced. Audit failure is
    // visible in operational logs; the caller doesn't fail.
  }

  return {
    verdict,
    attemptId,
    correlationId,
    approvalRequestNeeded: verdict.decision === "requires_approval",
  };
}
