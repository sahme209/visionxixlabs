/**
 * Canonical operational event taxonomy.
 *
 * Every meaningful change in Axiom — a connector validated, a scan completed,
 * an execution plan approved, a workflow step retried — is an event of one of
 * these typed shapes. Subscribers (audit log, command-center stream, memory
 * timeline) read from the same stream so they can't drift.
 *
 * Events are append-only and carry correlation/causation IDs so the full
 * decision chain for any action can be reconstructed.
 */

import type {
  ApprovalId,
  ConnectorId,
  CorrelationId,
  CausationId,
  ExecutionPlanId,
  ExecutionRunId,
  FindingId,
  JobId,
  MemoryRecordId,
  OrganizationId,
  PolicyRuleId,
  RecommendationId,
  ReleaseId,
  SnapshotId,
  UserId,
  WorkflowId,
  WorkflowRunId,
} from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";
import type { CloudProvider, ProviderId } from "@/lib/domain/provider";
import type { RiskLevel } from "@/lib/domain/status";

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface EventEnvelopeBase {
  /** Stable event id (`evt_<rand>`). */
  id: string;
  organizationId: OrganizationId;
  /** When the event was produced. */
  occurredAt: string;
  /** Causal lineage — which action triggered this event. */
  correlationId: CorrelationId;
  /** Optional direct parent event/action. */
  causationId?: CausationId;
  /** Actor responsible — user id, system, or external provider. */
  actor: { kind: "user"; userId: UserId } | { kind: "system"; component: string } | { kind: "external"; provider: ProviderId };
  /** Honest source of the underlying data. */
  source: DataSource;
}

// ---------------------------------------------------------------------------
// Domain payloads
// ---------------------------------------------------------------------------

export type AxiomEvent =
  | (EventEnvelopeBase & { kind: "connector.created";        connectorId: ConnectorId; provider: ProviderId })
  | (EventEnvelopeBase & { kind: "connector.validated";      connectorId: ConnectorId; provider: ProviderId; accountId?: string })
  | (EventEnvelopeBase & { kind: "connector.validation_failed"; connectorId: ConnectorId; provider: ProviderId; errorCode: string })
  | (EventEnvelopeBase & { kind: "connector.disconnected";   connectorId: ConnectorId; reason: string })
  | (EventEnvelopeBase & { kind: "scan.started";             connectorId: ConnectorId; provider: CloudProvider })
  | (EventEnvelopeBase & { kind: "scan.completed";           connectorId: ConnectorId; provider: CloudProvider; snapshotId: SnapshotId; resourceCount: number })
  | (EventEnvelopeBase & { kind: "scan.failed";              connectorId: ConnectorId; provider: CloudProvider; errorCode: string })
  | (EventEnvelopeBase & { kind: "snapshot.created";         snapshotId: SnapshotId; provider: CloudProvider; resourceCount: number })
  | (EventEnvelopeBase & { kind: "finding.generated";        findingId: FindingId; snapshotId: SnapshotId; risk: RiskLevel; ruleCode: string })
  | (EventEnvelopeBase & { kind: "recommendation.generated"; recommendationId: RecommendationId; findingId: FindingId })
  | (EventEnvelopeBase & { kind: "execution_plan.built";     executionPlanId: ExecutionPlanId; risk: RiskLevel; stepCount: number })
  | (EventEnvelopeBase & { kind: "execution_plan.submitted"; executionPlanId: ExecutionPlanId })
  | (EventEnvelopeBase & { kind: "execution_plan.approved";  executionPlanId: ExecutionPlanId; approvalId: ApprovalId })
  | (EventEnvelopeBase & { kind: "execution_plan.rejected";  executionPlanId: ExecutionPlanId; approvalId: ApprovalId; reason: string })
  | (EventEnvelopeBase & { kind: "execution_run.started";    executionRunId: ExecutionRunId; executionPlanId: ExecutionPlanId })
  | (EventEnvelopeBase & { kind: "execution_run.step_succeeded"; executionRunId: ExecutionRunId; stepIndex: number })
  | (EventEnvelopeBase & { kind: "execution_run.step_failed";    executionRunId: ExecutionRunId; stepIndex: number; errorCode: string })
  | (EventEnvelopeBase & { kind: "execution_run.completed";  executionRunId: ExecutionRunId })
  | (EventEnvelopeBase & { kind: "execution_run.rolled_back"; executionRunId: ExecutionRunId; reason: string })
  | (EventEnvelopeBase & { kind: "approval.requested";       approvalId: ApprovalId; executionPlanId: ExecutionPlanId })
  | (EventEnvelopeBase & { kind: "approval.granted";         approvalId: ApprovalId })
  | (EventEnvelopeBase & { kind: "approval.denied";          approvalId: ApprovalId; reason: string })
  | (EventEnvelopeBase & { kind: "policy.evaluated";         policyRuleId: PolicyRuleId; decision: "allow" | "block" | "warn"; subject: string })
  | (EventEnvelopeBase & { kind: "policy.blocked";           policyRuleId: PolicyRuleId; subject: string; reason: string })
  | (EventEnvelopeBase & { kind: "workflow.run_started";     workflowId: WorkflowId; workflowRunId: WorkflowRunId })
  | (EventEnvelopeBase & { kind: "workflow.run_completed";   workflowId: WorkflowId; workflowRunId: WorkflowRunId; outcome: "succeeded" | "failed" | "cancelled" })
  | (EventEnvelopeBase & { kind: "workflow.step_retried";    workflowRunId: WorkflowRunId; stepId: string; attempt: number })
  | (EventEnvelopeBase & { kind: "job.scheduled";            jobId: JobId; jobType: string })
  | (EventEnvelopeBase & { kind: "job.started";              jobId: JobId; jobType: string })
  | (EventEnvelopeBase & { kind: "job.completed";            jobId: JobId; jobType: string; outcome: "succeeded" | "failed" })
  | (EventEnvelopeBase & { kind: "release.observed";         releaseId: ReleaseId; provider: ProviderId })
  | (EventEnvelopeBase & { kind: "memory.recorded";          memoryRecordId: MemoryRecordId; recordKind: string });

export type AxiomEventKind = AxiomEvent["kind"];

/** Extract the payload of a specific event kind. */
export type EventOf<K extends AxiomEventKind> = Extract<AxiomEvent, { kind: K }>;
